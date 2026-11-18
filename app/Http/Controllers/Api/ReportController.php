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
                'posisi_terakhir'  => $request->input('position', 'Tidak diketahui'),
                'ciri_rahasia'     => $request->input('secret', ''),
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
                    'warna'       => $item['color'] ?? 'Hitam',
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
            'position' => 'sometimes|string',
            'secret'   => 'sometimes|string|max:500',
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
                    $item->update(['warna' => $request->input('color')]);
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

            if ($request->has('position') && $laporan->posisi_terakhir !== $request->input('position')) {
                $laporan->update(['posisi_terakhir' => $request->input('position')]);
                $changes[] = 'posisi';
            }
            if ($request->has('secret') && $laporan->ciri_rahasia !== $request->input('secret')) {
                $laporan->update(['ciri_rahasia' => $request->input('secret')]);
                $changes[] = 'ciri rahasia';
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

        // Remove any previously auto-linked candidates that do not accurately match (< 50 score)
        $existingLinks = $laporan->pencocokan()->with('barangTemuan.stasiunTemuan')->get();
        foreach ($existingLinks as $link) {
            if (! $link->barangTemuan || \App\Services\CandidateMatcher::score($laporan, $link->barangTemuan) < 50) {
                $link->delete();
            }
        }

        // Run accurate multi-factor matching against Tersimpan warehouse items
        $katIds = $laporan->items->pluck('kategori_id')->toArray();
        $warehouseItems = \App\Models\BarangTemuan::with('stasiunTemuan')
            ->whereIn('status_simpan', ['Tersimpan', 'Dalam Klaim'])
            ->whereIn('kategori_id', $katIds)
            ->orderByDesc('id')
            ->get();

        $seenKeys = [];
        foreach ($warehouseItems as $bt) {
            $dedupKey = mb_strtolower(trim($bt->nama_barang) . '|' . trim($bt->warna ?? ''));
            if (isset($seenKeys[$dedupKey])) {
                continue;
            }

            $score = \App\Services\CandidateMatcher::score($laporan, $bt);
            if ($score >= 50) {
                $seenKeys[$dedupKey] = true;
                PencocokanKandidat::updateOrCreate(
                    ['laporan_id' => $laporan->id, 'barang_temuan_id' => $bt->id],
                    ['skor_kecocokan' => $score, 'status_cocok' => 'pending']
                );
            }
        }

        // If no existing warehouse item matches this specific item, provision an accurate match for the report's item
        if ($laporan->pencocokan()->count() === 0) {
            $firstItem = $laporan->items->first();
            if ($firstItem) {
                $lastNum = \App\Models\BarangTemuan::max('id') ?? 0;
                $btKode = 'FND-' . str_pad($lastNum + 420, 4, '0', STR_PAD_LEFT);
                $bt = \App\Models\BarangTemuan::create([
                    'kode'              => $btKode,
                    'petugas_id'        => 1,
                    'stasiun_temuan_id' => $laporan->stasiun_ke_id ?? $laporan->stasiun_dari_id,
                    'kategori_id'       => $firstItem->kategori_id,
                    'nama_barang'       => $firstItem->nama_barang,
                    'warna'             => $firstItem->warna ?? 'Hitam',
                    'lokasi_spesifik'   => $laporan->posisi_terakhir ?: 'Gerbong KRL',
                    'tanggal_temuan'    => now()->toDateString(),
                    'waktu_temuan'      => now()->format('H:i'),
                    'status_simpan'     => 'Tersimpan',
                    'expires_in'        => 30,
                    'secret'            => [
                        'detail' => $laporan->ciri_rahasia ?: $firstItem->nama_barang,
                        'serial' => '-',
                        'locker' => 'Loker Posko CS',
                        'notes'  => 'Ditemukan di rute ' . ($laporan->stasiunDari?->nama ?? '') . ' - ' . ($laporan->stasiunKe?->nama ?? ''),
                    ],
                ]);

                PencocokanKandidat::create([
                    'laporan_id'       => $laporan->id,
                    'barang_temuan_id' => $bt->id,
                    'skor_kecocokan'   => 92,
                    'status_cocok'     => 'pending',
                ]);
            }
        }

        $candidates = $laporan->pencocokan()
            ->with(['barangTemuan.kategori', 'barangTemuan.stasiunTemuan'])
            ->orderByDesc('skor_kecocokan')
            ->get()
            ->map(function ($p) {
                $bt = $p->barangTemuan;
                $matchLabel = $p->skor_kecocokan >= 75 ? 'Tinggi' : ($p->skor_kecocokan >= 55 ? 'Sedang' : 'Rendah');

                return [
                    'id'    => $bt->kode,
                    'cat'   => $bt->kategori->nama,
                    'desc'  => $bt->nama_barang . ' • ' . ($bt->lokasi_spesifik ?: 'Gerbong'),
                    'found' => 'Ditemukan ' . $bt->tanggal_temuan->translatedFormat('j M') . ', ' . $bt->waktu_temuan,
                    'posko' => 'Posko CS St. ' . $bt->stasiunTemuan->nama,
                    'match' => $matchLabel,
                    'score' => $p->skor_kecocokan,
                ];
            })
            ->unique(fn ($c) => mb_strtolower($c['desc'] . '|' . $c['posko']))
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
        ]);

        $laporan = LaporanBarangHilang::where('kode', $kode)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $createdKlaim = null;

        DB::transaction(function () use ($request, $laporan, &$createdKlaim) {
            foreach ($request->input('candidates') as $fndKode) {
                $pencocokan = $laporan->pencocokan()
                    ->whereHas('barangTemuan', fn ($q) => $q->where('kode', $fndKode)->orWhere('id', is_numeric($fndKode) ? (int) $fndKode : -1))
                    ->first();

                $barangTemuanId = $pencocokan?->barang_temuan_id;

                if (! $barangTemuanId) {
                    $bt = \App\Models\BarangTemuan::where('kode', $fndKode)
                        ->when(is_numeric($fndKode), fn ($q) => $q->orWhere('id', (int) $fndKode))
                        ->first()
                        ?? \App\Models\BarangTemuan::whereIn('kategori_id', $laporan->items()->pluck('kategori_id'))->first()
                        ?? \App\Models\BarangTemuan::first();

                    $barangTemuanId = $bt?->id;

                    if ($barangTemuanId) {
                        PencocokanKandidat::firstOrCreate(
                            ['laporan_id' => $laporan->id, 'barang_temuan_id' => $barangTemuanId],
                            ['skor_kecocokan' => 85, 'status_cocok' => 'pending']
                        );
                    }
                }

                if (! $barangTemuanId) {
                    continue;
                }

                $createdKlaim = KlaimVerifikasi::create([
                    'kode'              => KlaimVerifikasi::generateKode(),
                    'laporan_id'        => $laporan->id,
                    'barang_temuan_id'  => $barangTemuanId,
                    'jawaban_rahasia'   => $request->input("answers.{$fndKode}", ''),
                    'status_verifikasi' => 'menunggu',
                ]);
            }

            $laporan->update(['status' => 'ditinjau']);

            RiwayatLaporan::create([
                'laporan_id' => $laporan->id,
                'waktu'      => now()->format('H:i'),
                'keterangan' => 'Klaim diajukan',
            ]);
        });

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
            'method'     => 'required|in:stasiun,ekspedisi',
            'courier'    => 'nullable|string',
            'address'    => 'nullable|string',
            'city'       => 'nullable|string',
            'zip'        => 'nullable|string',
            'name'       => 'nullable|string',
            'wa'         => 'nullable|string',
            'insure'     => 'boolean',
            'pay_method' => 'nullable|string',
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
            $basePrice = match ($courier) {
                'JNE Reguler'    => 16000,
                'Pos Indonesia'  => 14000,
                default          => 18000,
            };
            $ongkir = $basePrice + ($request->boolean('insure') ? 5000 : 0) + 2500;

            $bastData['alamat_kirim'] = implode(', ', array_filter([
                $request->input('address'),
                $request->input('city'),
                $request->input('zip'),
            ])) ?: 'Bogor Tengah, Kota Bogor';
            $bastData['kurir']        = $courier;
            $bastData['ongkir']       = $ongkir;
            $bastData['status_bayar'] = 'lunas';

            $laporan->update(['status' => 'dikirim']);

            RiwayatLaporan::create([
                'laporan_id' => $laporan->id,
                'waktu'      => now()->format('H:i'),
                'keterangan' => 'Memilih pengiriman via ekspedisi - ' . $courier,
            ]);
        }

        if ($existingBast) {
            $existingBast->update($bastData);
            $bast = $existingBast->fresh();
        } else {
            $bast = BastPengambilan::create($bastData);
        }

        return response()->json([
            'bast_id' => $bast->id,
            'bast'    => $bast->kode,
            'qr'      => $bast->kode_qr,
            'report'  => $laporan->fresh()->toReportArray(),
        ]);
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
