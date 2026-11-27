<?php

namespace App\Http\Controllers\Api;

use App\Models\DetailBarangHilang;
use App\Models\KategoriBarang;
use App\Models\KlaimVerifikasi;
use App\Models\LaporanBarangHilang;
use App\Models\PencocokanKandidat;
use App\Models\RiwayatLaporan;
use App\Models\Stasiun;
use App\Models\BastPengambilan;
use App\Services\BiteshipService;
use App\Services\NotificationService;
use App\Services\PaymentGatewayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController
{
    /**
     * GET /api/reports — list reports for the authenticated user
     */
    public function index(Request $request): JsonResponse
    {
        $reports = LaporanBarangHilang::where('user_id', $request->user()->id)
            ->with(['items.kategori', 'riwayat', 'stasiunDari', 'stasiunKe', 'pencocokan', 'klaim'])
            ->latest()
            ->get()
            ->map(fn ($lap) => $lap->toReportArray());

        return response()->json($reports);
    }

    /**
     * POST /api/reports — create a new report
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'items'          => 'required|array|min:1|max:5',
            'items.*.name'   => 'required|string|min:5|max:80',
            'items.*.category' => 'required|string',
            'items.*.color'  => 'nullable|string',
            'from'           => 'required|string',
            'to'             => 'required|string',
            'date'           => 'required|string',
            'time'           => 'required|string',
            'position'       => 'nullable|string',
            'secret'         => 'nullable|string|max:500',
            'notify'         => 'boolean',
        ]);

        // Stage-1 Anti-Spam: limit active reports created today per account
        $todayActiveCount = LaporanBarangHilang::where('user_id', $request->user()->id)
            ->whereDate('created_at', today())
            ->whereNotIn('status', ['selesai', 'dibatalkan', 'kedaluwarsa'])
            ->count();

        if ($todayActiveCount >= 5) {
            return response()->json([
                'message' => 'Batas maksimal 5 laporan aktif per hari telah tercapai.',
            ], 422);
        }

        $stasiunDari = Stasiun::where('nama', $request->input('from'))->firstOrFail();
        $stasiunKe   = Stasiun::where('nama', $request->input('to'))->firstOrFail();

        // Parse date — accept both "2 Nov 2026" and "2026-11-02" formats
        $tanggal = $this->parseIndonesianDate($request->input('date'));

        $report = DB::transaction(function () use ($request, $stasiunDari, $stasiunKe, $tanggal) {
            $kode = LaporanBarangHilang::generateKode();

            $laporan = LaporanBarangHilang::create([
                'kode'             => $kode,
                'user_id'          => $request->user()->id,
                'stasiun_dari_id'  => $stasiunDari->id,
                'stasiun_ke_id'    => $stasiunKe->id,
                'tanggal_kejadian' => $tanggal,
                'waktu_kejadian'   => $request->input('time'),
                'posisi_terakhir'  => $request->input('position') ?: 'Tidak diketahui',
                'ciri_rahasia'     => $request->input('secret') ?? '',
                'foto_referensi'   => $request->input('photo_url') ?? $request->input('foto_referensi'),
                'status'           => 'diterima',
                'notify'           => $request->boolean('notify', true),
            ]);

            foreach ($request->input('items') as $i => $item) {
                $kategori = KategoriBarang::where('nama', $item['category'])->first();
                DetailBarangHilang::create([
                    'laporan_id'  => $laporan->id,
                    'sub_kode'    => chr(65 + $i), // A, B, C...
                    'kategori_id' => $kategori?->id ?? 1,
                    'nama_barang' => $item['name'],
                    'warna'       => ! empty($item['color']) ? $item['color'] : 'Hitam',
                ]);
            }

            RiwayatLaporan::create([
                'laporan_id' => $laporan->id,
                'waktu'      => now()->format('H:i'),
                'keterangan' => 'Dibuat',
            ]);

            \App\Models\AuditLog::record(
                $request->user()->id,
                $request->user()->name . ' (Penumpang)',
                'Buat laporan kehilangan',
                $kode . ' • ' . ($request->input('items.0.name') ?? '')
            );

            return $laporan;
        });

        return response()->json([
            'report' => $report->fresh()->toReportArray(),
        ], 201);
    }

    /**
     * POST /api/reports/check-duplicate — detect similar existing report
     */
    public function checkDuplicate(Request $request): JsonResponse
    {
        $request->validate([
            'from'      => 'required|string',
            'to'        => 'required|string',
            'date'      => 'required|string',
            'time'      => 'nullable|string',
            'category'  => 'required|string',
        ]);

        $stasiunDari = Stasiun::where('nama', $request->input('from'))->first();
        $stasiunKe   = Stasiun::where('nama', $request->input('to'))->first();

        if (! $stasiunDari || ! $stasiunKe) {
            return response()->json(['duplicate' => false, 'report' => null]);
        }

        $tanggal = $this->parseIndonesianDate($request->input('date'));
        $kategori = KategoriBarang::where('nama', $request->input('category'))->first();

        $dup = LaporanBarangHilang::where('user_id', $request->user()->id)
            ->where('stasiun_dari_id', $stasiunDari->id)
            ->where('stasiun_ke_id', $stasiunKe->id)
            ->whereDate('tanggal_kejadian', $tanggal)
            ->whereNotIn('status', ['selesai', 'dibatalkan', 'kedaluwarsa'])
            ->whereHas('items', fn ($q) => $q->where('kategori_id', $kategori?->id))
            ->first();

        return response()->json([
            'duplicate' => (bool) $dup,
            'report'    => $dup ? $dup->toReportArray() : null,
        ]);
    }

    /**
     * PATCH /api/reports/{kode} — update a report
     */
    public function update(Request $request, string $kode): JsonResponse
    {
        $laporan = LaporanBarangHilang::where('kode', $kode)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        // Only allow edits on certain statuses
        if (! in_array($laporan->status, ['diterima', 'pencarian', 'kandidat'])) {
            return response()->json(['error' => 'Laporan tidak dapat diubah pada status ini.'], 422);
        }

        $request->validate([
            'name'     => 'sometimes|string|min:5|max:80',
            'color'    => 'sometimes|string',
            'category' => 'sometimes|string',
            'position' => 'nullable|string',
            'secret'   => 'nullable|string|max:500',
        ]);

        $changes = [];

        DB::transaction(function () use ($request, $laporan, &$changes) {
            // Update first item if relevant fields provided
            $item = $laporan->items()->first();
            if ($item) {
                if ($request->has('name') && $item->nama_barang !== $request->input('name')) {
                    $item->update(['nama_barang' => $request->input('name')]);
                    $changes[] = 'nama';
                }
                if ($request->has('color') && $item->warna !== $request->input('color')) {
                    $item->update(['warna' => $request->input('color') ?: 'Hitam']);
                    $changes[] = 'warna';
                }
                if ($request->has('category')) {
                    $kat = KategoriBarang::where('nama', $request->input('category'))->first();
                    if ($kat && $item->kategori_id !== $kat->id && $laporan->pencocokan()->count() === 0) {
                        $item->update(['kategori_id' => $kat->id]);
                        $changes[] = 'kategori';
                    }
                }
            }

            if ($request->has('position')) {
                $newPos = $request->input('position') ?: 'Tidak diketahui';
                if ($laporan->posisi_terakhir !== $newPos) {
                    $laporan->update(['posisi_terakhir' => $newPos]);
                    $changes[] = 'posisi';
                }
            }
            if ($request->has('secret')) {
                $newSecret = $request->input('secret') ?? '';
                if ($laporan->ciri_rahasia !== $newSecret) {
                    $laporan->update(['ciri_rahasia' => $newSecret]);
                    $changes[] = 'ciri rahasia';
                }
            }

            if (count($changes) > 0) {
                RiwayatLaporan::create([
                    'laporan_id' => $laporan->id,
                    'waktu'      => now()->format('H:i'),
                    'keterangan' => 'Diubah: ' . implode(', ', $changes),
                ]);
            }
        });

        return response()->json([
            'report'  => $laporan->fresh()->toReportArray(),
            'changes' => $changes,
        ]);
    }

    /**
     * POST /api/reports/cancel — cancel one or more reports
     */
    public function cancel(Request $request): JsonResponse
    {
        $request->validate([
            'ids'    => 'required|array|min:1',
            'ids.*'  => 'required|string',
            'reason' => 'required|string|min:5',
        ]);

        $requested = LaporanBarangHilang::whereIn('kode', $request->input('ids'))
            ->where('user_id', $request->user()->id)
            ->get();

        if ($requested->isEmpty()) {
            return response()->json(['error' => 'Laporan tidak ditemukan.'], 404);
        }

        $nonCancellable = $requested->filter(fn ($lap) => ! in_array($lap->status, ['diterima', 'pencarian', 'kandidat']));
        if ($nonCancellable->isNotEmpty()) {
            return response()->json([
                'message' => 'Laporan yang sudah masuk tahap verifikasi, BAST, atau pengiriman tidak dapat dibatalkan.',
                'error'   => 'Laporan tidak dapat dibatalkan pada status ini.',
            ], 422);
        }

        $cancelled = 0;

        DB::transaction(function () use ($request, $requested, &$cancelled) {
            foreach ($requested as $lap) {
                $lap->update([
                    'status'       => 'dibatalkan',
                    'alasan_batal' => $request->input('reason'),
                ]);

                RiwayatLaporan::create([
                    'laporan_id' => $lap->id,
                    'waktu'      => now()->format('H:i'),
                    'keterangan' => 'Dibatalkan: ' . $request->input('reason'),
                ]);

                $cancelled++;
            }
        });

        return response()->json([
            'cancelled' => $cancelled,
            'message'   => "{$cancelled} laporan dibatalkan.",
        ]);
    }

    /**
     * POST /api/reports/{kode}/reactivate — reactivate a cancelled report
     */
    public function reactivate(Request $request, string $kode): JsonResponse
    {
        $laporan = LaporanBarangHilang::where('kode', $kode)
            ->where('user_id', $request->user()->id)
            ->where('status', 'dibatalkan')
            ->firstOrFail();

        // Check if cancelled within 24 hours
        $lastCancel = $laporan->riwayat()
            ->where('keterangan', 'like', 'Dibatalkan:%')
            ->latest()
            ->first();

        if ($lastCancel && $lastCancel->created_at->diffInHours(now()) > 24) {
            return response()->json([
                'error' => 'Batas waktu reaktivasi 24 jam telah lewat.',
            ], 422);
        }

        DB::transaction(function () use ($laporan) {
            $laporan->update([
                'status'       => 'pencarian',
                'alasan_batal' => null,
            ]);

            RiwayatLaporan::create([
                'laporan_id' => $laporan->id,
                'waktu'      => now()->format('H:i'),
                'keterangan' => 'Diaktifkan kembali',
            ]);
        });

        return response()->json([
            'report' => $laporan->fresh()->toReportArray(),
        ]);
    }

    /**
     * POST /api/reports/merge — merge 2 reports into one
     */
    public function merge(Request $request): JsonResponse
    {
        $request->validate([
            'ids'   => 'required|array|size:2',
            'ids.*' => 'required|string',
        ]);

        [$kode1, $kode2] = $request->input('ids');

        $lap1 = LaporanBarangHilang::where('kode', $kode1)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $lap2 = LaporanBarangHilang::where('kode', $kode2)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        // Validate same route and date
        if (
            $lap1->stasiun_dari_id !== $lap2->stasiun_dari_id ||
            $lap1->stasiun_ke_id   !== $lap2->stasiun_ke_id   ||
            $lap1->tanggal_kejadian->toDateString() !== $lap2->tanggal_kejadian->toDateString()
        ) {
            return response()->json([
                'error' => 'Hanya laporan dengan rute dan tanggal yang sama yang bisa digabungkan.',
            ], 422);
        }

        DB::transaction(function () use ($lap1, $lap2) {
            // Move items from lap2 to lap1
            $existingCount = $lap1->items()->count();
            foreach ($lap2->items as $i => $item) {
                $item->update([
                    'laporan_id' => $lap1->id,
                    'sub_kode'   => chr(65 + $existingCount + $i),
                ]);
            }

            // Log the merge
            RiwayatLaporan::create([
                'laporan_id' => $lap1->id,
                'waktu'      => now()->format('H:i'),
                'keterangan' => "Digabungkan dari #{$lap2->kode}",
            ]);

            // Cancel the second report
            $lap2->update(['status' => 'dibatalkan', 'alasan_batal' => "Digabungkan ke #{$lap1->kode}"]);
            RiwayatLaporan::create([
                'laporan_id' => $lap2->id,
                'waktu'      => now()->format('H:i'),
                'keterangan' => "Digabungkan ke #{$lap1->kode}",
            ]);
        });

        return response()->json([
            'report' => $lap1->fresh()->toReportArray(),
        ]);
    }

    /**
     * GET /api/reports/{kode}/candidates — get candidate found items for a report
     */
    public function candidates(Request $request, string $kode): JsonResponse
    {
        $laporan = LaporanBarangHilang::where('kode', $kode)
            ->where('user_id', $request->user()->id)
            ->with(['items.kategori', 'stasiunDari', 'stasiunKe'])
            ->firstOrFail();

        // Stage-1 Trust Gate: do not expose warehouse candidates while report is still in 'diterima' or 'pencarian'
        if (! in_array($laporan->status, ['kandidat', 'ditinjau', 'perlu_info', 'ditolak'])) {
            return response()->json([]);
        }

        // Only return candidates that were legitimately linked by CS auto-match or CS manual match (with blind masking)
        $candidates = $laporan->pencocokan()
            ->with(['barangTemuan.kategori', 'barangTemuan.stasiunTemuan'])
            ->orderByDesc('skor_kecocokan')
            ->get()
            ->filter(fn ($p) => (bool) $p->barangTemuan)
            ->map(function ($p) {
                $bt = $p->barangTemuan;
                $matchLabel = $p->skor_kecocokan >= 75 ? 'Tinggi' : ($p->skor_kecocokan >= 55 ? 'Sedang' : 'Rendah');

                return [
                    'id'    => $bt->kode,
                    'cat'   => $bt->kategori?->nama ?? 'Barang',
                    'desc'  => ($bt->kategori?->nama ?? 'Barang') . ' • Warna ' . ($bt->warna ?: 'Tidak spesifik'),
                    'found' => 'Ditemukan ' . $bt->tanggal_temuan->translatedFormat('j M') . ', ' . ($bt->waktu_temuan ?? '-'),
                    'posko' => 'Posko CS St. ' . ($bt->stasiunTemuan?->nama ?? '-'),
                    'match' => $matchLabel,
                    'score' => $p->skor_kecocokan,
                ];
            })
            ->unique(fn ($c) => mb_strtolower($c['id']))
            ->values();

        return response()->json($candidates);
    }

    /**
     * POST /api/reports/{kode}/claim — submit claim verification
     */
    public function claim(Request $request, string $kode): JsonResponse
    {
        // Support both array format { candidates: [...], answers: {...} } and single format { candidate_id, answer }
        if (! $request->has('candidates') && ($request->has('candidate_id') || $request->has('barang_temuan_id'))) {
            $cid = (string) ($request->input('candidate_id') ?? $request->input('barang_temuan_id'));
            $ans = (string) ($request->input('answer') ?? $request->input('jawaban_rahasia') ?? 'Ciri barang sesuai dengan deskripsi laporan kehilangan penumpang.');
            $request->merge([
                'candidates' => [$cid],
                'answers'    => [$cid => $ans],
            ]);
        }

        $request->validate([
            'candidates'       => 'required|array|min:1',
            'candidates.*'     => 'required|string',
            'answers'          => 'required|array',
            'answers.*'        => 'required|string|min:10',
            'nik'              => 'nullable|string|size:16',
            'ktp_url'          => 'nullable|string',
        ]);

        $laporan = LaporanBarangHilang::where('kode', $kode)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        // Stage-2 Trust Gate: require CS-linked candidate status before claiming
        if (! in_array($laporan->status, ['kandidat', 'perlu_info', 'ditolak'])) {
            return response()->json([
                'message' => 'Belum ada kandidat barang yang ditautkan petugas CS untuk laporan ini.',
            ], 422);
        }

        // Anti-abuse: lock online claim after 2 rejections
        if ($laporan->klaim()->where('status_verifikasi', 'ditolak')->count() >= 2) {
            return response()->json([
                'message' => 'Batas pengajuan klaim online (2x) telah tercapai. Silakan datang langsung ke Posko CS.',
            ], 422);
        }

        if ($request->filled('nik')) {
            $request->user()->update(['nik' => $request->input('nik')]);
        }

        $createdKlaim = null;
        $claimedCount = 0;

        DB::transaction(function () use ($request, $laporan, &$createdKlaim, &$claimedCount) {
            foreach ($request->input('candidates') as $fndKode) {
                $pencocokan = $laporan->pencocokan()
                    ->with('barangTemuan')
                    ->whereHas('barangTemuan', fn ($q) => $q->where('kode', $fndKode)->orWhere('id', is_numeric($fndKode) ? (int) $fndKode : -1))
                    ->first();

                if (! $pencocokan || ! $pencocokan->barangTemuan) {
                    continue;
                }

                $bt = $pencocokan->barangTemuan;
                if ($bt->status_simpan === 'Tersimpan') {
                    $bt->update(['status_simpan' => 'Dalam Klaim']);
                }

                $createdKlaim = KlaimVerifikasi::create([
                    'kode'              => KlaimVerifikasi::generateKode(),
                    'laporan_id'        => $laporan->id,
                    'barang_temuan_id'  => $bt->id,
                    'jawaban_rahasia'   => $request->input("answers.{$fndKode}", ''),
                    'nik'               => $request->input('nik') ?: $request->user()->nik,
                    'bukti_tambahan'    => $request->input('ktp_url'),
                    'status_verifikasi' => 'menunggu',
                ]);
                $claimedCount++;
            }

            if ($claimedCount > 0) {
                $laporan->update(['status' => 'ditinjau']);

                RiwayatLaporan::create([
                    'laporan_id' => $laporan->id,
                    'waktu'      => now()->format('H:i'),
                    'keterangan' => 'Klaim diajukan',
                ]);
            }
        });

        if ($claimedCount === 0) {
            return response()->json([
                'message' => 'Kandidat barang tidak valid atau tidak tertaut dengan laporan Anda.',
            ], 422);
        }

        return response()->json([
            'claim_id' => $createdKlaim?->id,
            'claim'    => $createdKlaim?->kode,
            'report'   => $laporan->fresh()->toReportArray(),
        ]);
    }

    /**
     * POST /api/reports/{kode}/bast — confirm pickup method (station or shipping)
     */
    public function bast(Request $request, string $kode): JsonResponse
    {
        $request->validate([
            'method'          => 'required|in:stasiun,ekspedisi',
            'courier'         => 'nullable|string',
            'courier_company' => 'nullable|string|max:40',
            'courier_type'    => 'nullable|string|max:40',
            'address'         => 'nullable|string',
            'city'            => 'nullable|string',
            'zip'             => 'nullable|string',
            'name'            => 'nullable|string',
            'wa'              => 'nullable|string',
            'insure'          => 'boolean',
            'pay_method'      => 'nullable|string',
        ]);

        $laporan = LaporanBarangHilang::where('kode', $kode)
            ->where('user_id', $request->user()->id)
            ->whereIn('status', ['bast', 'dikirim'])
            ->firstOrFail();

        $klaim = $laporan->klaim()
            ->where('status_verifikasi', 'disetujui')
            ->latest()
            ->first();

        // If no approved claim yet, use the first claim
        if (! $klaim) {
            $klaim = $laporan->klaim()->latest()->firstOrFail();
        }

        $method = $request->input('method');
        $existingBast = BastPengambilan::where('klaim_id', $klaim->id)->latest()->first();

        $bastData = [
            'kode'           => $existingBast?->kode ?? BastPengambilan::generateKode(),
            'klaim_id'       => $klaim->id,
            'metode_ambil'   => $method,
        ];

        $snap = null;
        $midtransMode = 'simulation';

        if ($method === 'stasiun') {
            $bastData['stasiun_ambil_id'] = $laporan->stasiunKe->id;
            $bastData['kode_qr'] = $existingBast?->kode_qr ?? ('KCI-' . now()->year . '-' . str_pad($laporan->id, 3, '0', STR_PAD_LEFT));

            RiwayatLaporan::create([
                'laporan_id' => $laporan->id,
                'waktu'      => now()->format('H:i'),
                'keterangan' => 'Memilih ambil mandiri di stasiun',
            ]);
        } else {
            $courier = $request->input('courier', 'KAI Logistik Express');
            $company = $request->input('courier_company');
            $type = $request->input('courier_type');
            $zip = preg_replace('/\D+/', '', (string) $request->input('zip', '')) ?? '';

            $basePrice = match ($courier) {
                'JNE Reguler'    => 16000,
                'Pos Indonesia'  => 14000,
                default          => 18000,
            };

            $biteship = app(BiteshipService::class);
            if ($biteship->isConfigured() && $company && $type && strlen($zip) === 5) {
                $rates = $biteship->getRates($zip);
                foreach ($rates['couriers'] ?? [] as $rateOpt) {
                    if (
                        strtolower((string) ($rateOpt['company'] ?? '')) === strtolower((string) $company) &&
                        strtolower((string) ($rateOpt['type'] ?? '')) === strtolower((string) $type)
                    ) {
                        $basePrice = (int) $rateOpt['price'];
                        $courier = (string) ($rateOpt['k'] ?? $courier);
                        break;
                    }
                }
            }

            $insure = $request->boolean('insure');
            $insureFee = $insure ? 5000 : 0;
            $adminFee = 2500;
            $ongkir = $basePrice + $insureFee + $adminFee;

            $bastData['alamat_kirim'] = implode(', ', array_filter([
                $request->input('address'),
                $request->input('city'),
                $request->input('zip'),
            ])) ?: 'Bogor Tengah, Kota Bogor';
            $bastData['destination_postal_code'] = strlen($zip) === 5 ? $zip : ($existingBast?->destination_postal_code ?? '16143');
            $bastData['recipient_name'] = $request->input('name') ?: $request->user()->name;
            $bastData['recipient_phone'] = $request->input('wa') ?: $request->user()->phone;
            $bastData['kurir'] = $courier;
            $bastData['courier_company'] = $company ?: $existingBast?->courier_company;
            $bastData['courier_type'] = $type ?: $existingBast?->courier_type;
            $bastData['ongkir'] = $ongkir;

            $pg = app(PaymentGatewayService::class);
            if ($pg->isConfigured()) {
                $midtransMode = $pg->isProduction() ? 'production' : 'sandbox';
                $orderId = $pg->generateOrderId($bastData['kode']);

                $itemDetails = [
                    [
                        'id'       => 'ONGKIR',
                        'price'    => $basePrice,
                        'quantity' => 1,
                        'name'     => substr("Ongkos Kirim {$courier}", 0, 50),
                    ],
                ];
                if ($insureFee > 0) {
                    $itemDetails[] = [
                        'id'       => 'INSURANCE',
                        'price'    => $insureFee,
                        'quantity' => 1,
                        'name'     => 'Proteksi Asuransi Pengiriman',
                    ];
                }
                $itemDetails[] = [
                    'id'       => 'ADMIN_FEE',
                    'price'    => $adminFee,
                    'quantity' => 1,
                    'name'     => 'Biaya Layanan LoFound',
                ];

                $tempBast = $existingBast ?? new BastPengambilan($bastData);
                $tempBast->kode = $bastData['kode'];
                $tempBast->ongkir = $ongkir;

                $baseUrl = rtrim($request->getSchemeAndHttpHost() ?: (string) config('app.url'), '/');
                $returnUrl = PaymentGatewayService::buildReturnUrl($baseUrl, $laporan->kode, (int) $request->user()->id);

                $snap = $pg->createSnapTransaction(
                    $tempBast,
                    [
                        'name'  => $request->input('name') ?: $request->user()->name,
                        'wa'    => $request->input('wa') ?: $request->user()->phone,
                        'email' => $request->user()->email,
                    ],
                    [
                        'order_id'     => $orderId,
                        'item_details' => $itemDetails,
                        'pay_method'   => $request->input('pay_method'),
                        'finish_url'   => $returnUrl,
                        'unfinish_url' => $returnUrl,
                        'error_url'    => $returnUrl,
                        'shipping_address' => [
                            'first_name'  => $request->input('name') ?: $request->user()->name,
                            'phone'       => $request->input('wa') ?: $request->user()->phone,
                            'address'     => (string) $request->input('address', ''),
                            'city'        => (string) $request->input('city', ''),
                            'postal_code' => (string) $request->input('zip', ''),
                        ],
                    ]
                );

                if (! ($snap['ok'] ?? false)) {
                    return response()->json([
                        'message'       => 'Gagal memproses transaksi pembayaran. Silakan coba lagi.',
                        'gateway_error' => $snap['error'] ?? null,
                    ], 502);
                }

                $bastData['midtrans_order_id'] = $snap['order_id'] ?? $orderId;
                $bastData['snap_token'] = $snap['token'] ?? null;
                $bastData['payment_url'] = $snap['redirect_url'] ?? null;
                $bastData['status_bayar'] = 'pending';

                RiwayatLaporan::create([
                    'laporan_id' => $laporan->id,
                    'waktu'      => now()->format('H:i'),
                    'keterangan' => "Menunggu pembayaran ongkir ekspedisi ({$bastData['kode']}) - {$courier}",
                ]);
            } else {
                $bastData['status_bayar'] = 'lunas';
                $laporan->update(['status' => 'dikirim']);

                RiwayatLaporan::create([
                    'laporan_id' => $laporan->id,
                    'waktu'      => now()->format('H:i'),
                    'keterangan' => 'Memilih pengiriman via ekspedisi - ' . $courier,
                ]);
            }
        }

        if ($existingBast) {
            $existingBast->update($bastData);
            $bast = $existingBast->fresh();
        } else {
            $bast = BastPengambilan::create($bastData);
        }

        return response()->json([
            'bast_id'       => $bast->id,
            'bast'          => $bast->kode,
            'qr'            => $bast->kode_qr,
            'order_id'      => $bast->midtrans_order_id ?? $bast->kode,
            'payment_url'   => $bast->payment_url,
            'snap_token'    => $bast->snap_token,
            'midtrans_mode' => $midtransMode,
            'report'        => $laporan->fresh()->toReportArray(),
        ]);
    }

    /**
     * POST /api/reports/{kode}/bast/sync-payment — query Midtrans Status API v2 for localhost/popup verification
     */
    public function syncPayment(Request $request, string $kode, PaymentGatewayService $pg): JsonResponse
    {
        $laporan = LaporanBarangHilang::where('kode', $kode)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $klaim = $laporan->klaim()
            ->where('status_verifikasi', 'disetujui')
            ->latest()
            ->first() ?? $laporan->klaim()->latest()->firstOrFail();

        $bast = BastPengambilan::where('klaim_id', $klaim->id)->latest()->firstOrFail();

        if (in_array($bast->status_bayar, ['lunas', 'selesai'], true)) {
            return response()->json([
                'payment_status'     => 'lunas',
                'transaction_status' => 'settlement',
                'payment_type'       => $bast->payment_type,
                'report'             => $laporan->fresh()->toReportArray(),
            ]);
        }

        if (! $pg->isConfigured()) {
            return response()->json([
                'message' => 'Layanan pembayaran sedang tidak tersedia.',
            ], 422);
        }

        $orderId = $bast->midtrans_order_id ?? $bast->kode;
        $status = $pg->getTransactionStatus($orderId);

        if (! $status || ($status['status_code'] ?? '') === '404') {
            return response()->json([
                'payment_status'     => 'pending',
                'transaction_status' => 'unpaid',
                'payment_type'       => null,
                'message'            => 'Pembayaran belum diselesaikan. Silakan selesaikan pembayaran Anda terlebih dahulu.',
                'report'             => $laporan->fresh()->toReportArray(),
            ]);
        }

        $txStatus = strtolower((string) ($status['transaction_status'] ?? 'pending'));
        $fraudStatus = $status['fraud_status'] ?? null;
        $paymentType = $status['payment_type'] ?? null;

        $paymentStatus = $pg->applyPaymentStatus(
            $bast,
            $txStatus,
            is_string($fraudStatus) ? $fraudStatus : null,
            is_string($paymentType) ? $paymentType : null,
            'Payment Status Sync'
        );

        return response()->json([
            'payment_status'     => $paymentStatus,
            'transaction_status' => $txStatus,
            'payment_type'       => $paymentType,
            'report'             => $laporan->fresh()->toReportArray(),
        ]);
    }

    /**
     * POST /api/reports/{kode}/bast/cancel-payment — cancel pending shipping payment so user can recreate
     */
    public function cancelPayment(Request $request, string $kode, PaymentGatewayService $pg): JsonResponse
    {
        $laporan = LaporanBarangHilang::where('kode', $kode)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $klaim = $laporan->klaim()
            ->where('status_verifikasi', 'disetujui')
            ->latest()
            ->first() ?? $laporan->klaim()->latest()->firstOrFail();

        $bast = BastPengambilan::where('klaim_id', $klaim->id)->latest()->firstOrFail();

        if (in_array($bast->status_bayar, ['lunas', 'selesai'], true)) {
            return response()->json([
                'message' => 'Pembayaran sudah lunas dan tidak dapat dibatalkan.',
            ], 422);
        }

        if ($pg->isConfigured() && $bast->midtrans_order_id) {
            $pg->cancelTransaction($bast->midtrans_order_id);
        }

        $bast->update([
            'status_bayar' => 'gagal',
            'snap_token'   => null,
            'payment_url'  => null,
        ]);

        RiwayatLaporan::create([
            'laporan_id' => $laporan->id,
            'waktu'      => now()->format('H:i'),
            'keterangan' => "Pembayaran ongkir dibatalkan oleh penumpang untuk dibuat ulang ({$bast->kode})",
        ]);

        return response()->json([
            'ok'      => true,
            'message' => 'Pembayaran berhasil dibatalkan.',
            'report'  => $laporan->fresh()->toReportArray(),
        ]);
    }

    /**
     * POST /api/shipping/rates — fetch real-time Biteship courier rates (or fallback options)
     */
    public function shippingRates(Request $request, BiteshipService $biteship): JsonResponse
    {
        $request->validate([
            'postal_code' => 'required|string|regex:/^\d{5}$/',
        ]);

        return response()->json($biteship->getRates((string) $request->input('postal_code')));
    }

    /**
     * POST /api/reports/{kode}/bast/sync-shipping — sync live courier tracking from Biteship
     */
    public function syncShipping(Request $request, string $kode, BiteshipService $biteship): JsonResponse
    {
        $laporan = LaporanBarangHilang::where('kode', $kode)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $klaim = $laporan->klaim()
            ->where('status_verifikasi', 'disetujui')
            ->latest()
            ->first() ?? $laporan->klaim()->latest()->firstOrFail();

        $bast = BastPengambilan::where('klaim_id', $klaim->id)->latest()->firstOrFail();

        if (($bast->biteship_tracking_id || $bast->biteship_order_id) && $biteship->isConfigured()) {
            $tracking = $biteship->getTracking($bast->biteship_tracking_id, $bast->biteship_order_id);
            if ($tracking) {
                $biteship->applyTrackingUpdate(
                    $bast,
                    $tracking['status'],
                    $tracking['waybill_id'] ?? null,
                    $tracking['history'] ?? [],
                    'Biteship Sync'
                );
            }
        }

        $freshBast = $bast->fresh();

        return response()->json([
            'shipping_status' => $freshBast->shipping_status ?? $freshBast->status_bayar,
            'awb'             => $freshBast->nomor_resi,
            'history'         => $freshBast->tracking_history ?? [],
            'report'          => $laporan->fresh()->toReportArray(),
        ]);
    }

    /**
     * GET /api/notifications — real-time in-app notifications from report history.
     */
    public function notifications(Request $request): JsonResponse
    {
        $items = RiwayatLaporan::with('laporan')
            ->whereHas('laporan', fn ($q) => $q->where('user_id', $request->user()->id))
            ->orderByDesc('created_at')
            ->limit(30)
            ->get()
            ->map(function (RiwayatLaporan $h) {
                $lap = $h->laporan;
                $text = (string) $h->keterangan;
                $title = match (true) {
                    str_contains(strtolower($text), 'disetujui') => 'Klaim Disetujui & BAST Terbit',
                    str_contains(strtolower($text), 'kandidat') || str_contains(strtolower($text), 'ditautkan') => 'Kandidat Barang Ditemukan',
                    str_contains(strtolower($text), 'ditolak') => 'Klaim Belum Disetujui',
                    str_contains(strtolower($text), 'info') => 'Permintaan Info Tambahan CS',
                    str_contains(strtolower($text), 'kurir') || str_contains(strtolower($text), 'resi') => 'Update Pengiriman Ekspedisi',
                    str_contains(strtolower($text), 'selesai') => 'Barang Berhasil Diterima',
                    default => 'Pembaruan Laporan',
                };

                return [
                    'id'        => $h->id,
                    'report_id' => $lap?->kode ?? '',
                    'title'     => $title,
                    'body'      => ($lap ? "#{$lap->kode} • " : '') . $text,
                    't'         => $h->created_at?->isToday() ? $h->waktu : ($h->created_at?->format('j M, H:i') ?? $h->waktu),
                    'unread'    => (bool) ($h->created_at && $h->created_at->gt(now()->subHours(24))),
                ];
            })
            ->values();

        return response()->json($items);
    }

    /**
     * Parse both ISO dates and Indonesian formatted dates (e.g. "30 Okt 2026", "Hari Ini").
     */
    private function parseIndonesianDate(?string $dateStr): string
    {
        if (! $dateStr || strtolower(trim($dateStr)) === 'hari ini') {
            return now()->toDateString();
        }

        $translated = str_ireplace(
            ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            $dateStr
        );

        try {
            return \Carbon\Carbon::parse($translated)->toDateString();
        } catch (\Exception) {
            return now()->toDateString();
        }
    }
}
