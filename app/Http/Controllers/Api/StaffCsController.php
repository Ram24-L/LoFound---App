<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\BarangTemuan;
use App\Models\BastPengambilan;
use App\Models\DetailBarangHilang;
use App\Models\KategoriBarang;
use App\Models\KlaimVerifikasi;
use App\Models\LaporanBarangHilang;
use App\Models\PencocokanKandidat;
use App\Models\RiwayatLaporan;
use App\Models\Stasiun;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class StaffCsController extends Controller
{
    /**
     * GET /api/staff/cs/dashboard
     * Returns inventory, active reports, and claim queue.
     */
    public function dashboard(Request $request)
    {
        $user = $request->user();
        $stasiunId = $user->stasiun_id;

        // Inventory (found items) for this station or all if admin
        $inventoryQuery = BarangTemuan::with(['kategori', 'stasiunTemuan', 'petugas'])
            ->orderByDesc('created_at');

        if ($stasiunId) {
            $inventoryQuery->where('stasiun_temuan_id', $stasiunId);
        }

        $inventory = $inventoryQuery->get()->map(fn($bt) => $this->mapInventoryItem($bt));

        // Claims queue (existing KlaimVerifikasi + active LaporanBarangHilang without a claim yet)
        $existingClaims = KlaimVerifikasi::with(['laporan.detailBarang.kategori', 'laporan.user', 'barangTemuan', 'verifier'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($k) => $this->mapClaim($k));

        $unclaimedReports = LaporanBarangHilang::with(['detailBarang.kategori', 'user', 'stasiunDari', 'stasiunKe', 'pencocokan.barangTemuan'])
            ->whereIn('status', ['diterima', 'pencarian', 'kandidat', 'ditinjau', 'perlu_info'])
            ->whereDoesntHave('klaim')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($lap) => $this->mapReportAsClaim($lap));

        $claims = $unclaimedReports->concat($existingClaims)->values();

        // Pending BASTs for station handover
        $pendingBasts = BastPengambilan::with(['klaim.laporan.user', 'klaim.laporan.detailBarang', 'klaim.barangTemuan'])
            ->whereNull('waktu_serah_terima')
            ->where('metode_ambil', 'stasiun')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($b) => [
                'kode'   => $b->kode,
                'qr'     => $b->kode_qr ?? $b->kode,
                'report' => $b->klaim?->laporan?->kode,
                'owner'  => $b->klaim?->laporan?->user?->name ?? 'Penumpang',
                'item'   => $b->klaim?->laporan?->detailBarang?->first()?->nama_barang ?? $b->klaim?->barangTemuan?->nama_barang ?? '',
            ]);

        // Summary counts
        $counts = [
            'tersimpan'     => BarangTemuan::where('status_simpan', 'Tersimpan')->count(),
            'dalam_klaim'   => BarangTemuan::where('status_simpan', 'Dalam Klaim')->count() + $unclaimedReports->count(),
            'selesai_bulan' => BarangTemuan::where('status_simpan', 'Selesai')
                ->whereMonth('updated_at', now()->month)->count(),
            'expiring'      => BarangTemuan::where('status_simpan', 'Tersimpan')
                ->where('expires_in', '<=', 3)->count(),
        ];

        return response()->json([
            'inventory'     => $inventory,
            'claims'        => $claims,
            'counts'        => $counts,
            'pending_basts' => $pendingBasts,
        ]);
    }

    /**
     * POST /api/staff/cs/found-items — Record a new found item + auto-match.
     */
    public function storeFoundItem(Request $request)
    {
        $request->validate([
            'cat'     => 'required|string',
            'name'    => 'required|string|min:3',
            'color'   => 'nullable|string',
            'station' => 'required|string',
            'detail'  => 'nullable|string',
            'serial'  => 'nullable|string',
            'locker'  => 'nullable|string',
            'notes'   => 'nullable|string',
        ]);

        $user = $request->user();
        $kategori = KategoriBarang::where('nama', $request->cat)->first();
        $stasiun = Stasiun::where('nama', $request->station)->first();

        if (!$kategori || !$stasiun) {
            return response()->json(['message' => 'Kategori atau stasiun tidak valid.'], 422);
        }

        // Check serial duplicate
        if ($request->serial && $request->serial !== '-') {
            $dup = BarangTemuan::whereJsonContains('secret->serial', $request->serial)->first();
            if ($dup) {
                return response()->json(['message' => "Nomor seri sudah terdaftar pada barang lain (#{$dup->kode})."], 422);
            }
        }

        // Generate code
        $lastNum = BarangTemuan::max('id') ?? 0;
        $kode = 'FND-' . str_pad($lastNum + 420, 4, '0', STR_PAD_LEFT);

        $bt = BarangTemuan::create([
            'kode'              => $kode,
            'petugas_id'        => $user->id,
            'stasiun_temuan_id' => $stasiun->id,
            'kategori_id'       => $kategori->id,
            'nama_barang'       => $request->name,
            'warna'             => $request->color ?? 'Hitam',
            'tanggal_temuan'    => now()->toDateString(),
            'waktu_temuan'      => now()->format('H:i'),
            'foto_barang'       => $request->input('photo_url') ?? $request->input('foto_barang'),
            'status_simpan'     => 'Tersimpan',
            'expires_in'        => $kategori->retention_days ?? 30,
            'secret'            => [
                'detail' => $request->detail ?? '',
                'serial' => $request->serial ?? '-',
                'locker' => $request->locker ?? '',
                'notes'  => $request->notes ?? '',
                'photo'  => $request->input('photo_url') ?? $request->input('foto_barang'),
            ],
        ]);

        AuditLog::record($user->id, $user->name . ' (CS)', 'Catat barang temuan', $kode);

        // Auto-match: find reports with same category and active status using accurate CandidateMatcher
        $matches = LaporanBarangHilang::with(['items', 'stasiunDari', 'stasiunKe'])
            ->whereIn('status', ['diterima', 'pencarian', 'kandidat'])
            ->whereHas('detailBarang', function ($q) use ($kategori) {
                $q->where('kategori_id', $kategori->id);
            })
            ->get();

        $matchedCount = 0;

        foreach ($matches as $laporan) {
            $score = \App\Services\CandidateMatcher::score($laporan, $bt);

            // Only create match if score >= 50
            if ($score < 50) {
                continue;
            }

            $matchedCount++;

            PencocokanKandidat::updateOrCreate(
                [
                    'laporan_id'       => $laporan->id,
                    'barang_temuan_id' => $bt->id,
                ],
                [
                    'skor_kecocokan'   => min(100, $score),
                    'status_cocok'     => 'pending',
                ]
            );

            // Update report status to 'kandidat' if still in earlier status
            if (in_array($laporan->status, ['diterima', 'pencarian'])) {
                $laporan->update(['status' => 'kandidat']);
                RiwayatLaporan::create([
                    'laporan_id' => $laporan->id,
                    'waktu'      => now()->format('H:i'),
                    'keterangan' => "Kandidat barang ditemukan: {$kode}",
                ]);
            }

            AuditLog::record(null, 'Sistem', 'Cocokkan otomatis', "{$kode} → {$laporan->kode}");
        }

        $bt->load(['kategori', 'stasiunTemuan', 'petugas']);

        return response()->json([
            'item'    => $this->mapInventoryItem($bt),
            'matches' => $matchedCount,
        ]);
    }

    /**
     * PATCH /api/staff/cs/found-items/{kode} — Update a found item.
     */
    public function updateFoundItem(Request $request, string $kode)
    {
        $bt = BarangTemuan::where('kode', $kode)->firstOrFail();
        $user = $request->user();

        $claimLocked = $bt->status_simpan === 'Dalam Klaim';

        $fields = ['notes' => $request->notes];
        if (!$claimLocked) {
            if ($request->has('cat')) {
                $kat = KategoriBarang::where('nama', $request->cat)->first();
                if ($kat) $fields['kategori_id'] = $kat->id;
            }
            if ($request->has('name'))    $fields['nama_barang'] = $request->name;
            if ($request->has('color'))   $fields['warna'] = $request->color;
            if ($request->has('station')) {
                $st = Stasiun::where('nama', $request->station)->first();
                if ($st) $fields['stasiun_temuan_id'] = $st->id;
            }
        }

        // Update secret fields
        $secret = $bt->secret ?? [];
        foreach (['detail', 'serial', 'locker', 'notes'] as $k) {
            if ($request->has($k)) $secret[$k] = $request->$k;
        }
        $fields['secret'] = $secret;

        $bt->update($fields);
        $bt->load(['kategori', 'stasiunTemuan', 'petugas']);

        AuditLog::record($user->id, $user->name . ' (CS)', 'Ubah data barang', $kode);

        return response()->json(['item' => $this->mapInventoryItem($bt)]);
    }

    /**
     * POST /api/staff/cs/found-items/{kode}/status — Change status.
     */
    public function changeStatus(Request $request, string $kode)
    {
        $bt = BarangTemuan::where('kode', $kode)->firstOrFail();
        $user = $request->user();
        $status = $request->input('status');
        $reason = $request->input('reason', '');

        if ($status === 'Diarsipkan' && !$reason) {
            return response()->json(['message' => 'Alasan arsip wajib diisi.'], 422);
        }

        $bt->update(['status_simpan' => $status]);
        $bt->load(['kategori', 'stasiunTemuan', 'petugas']);

        $act = $status === 'Diarsipkan' ? "Arsipkan barang: {$reason}" : "Ubah status ke \"{$status}\"";
        AuditLog::record($user->id, $user->name . ' (CS)', $act, $kode);

        return response()->json(['item' => $this->mapInventoryItem($bt)]);
    }

    /**
     * POST /api/staff/cs/found-items/{kode}/match — Manual match to report.
     */
    public function manualMatch(Request $request, string $kode)
    {
        $bt = BarangTemuan::where('kode', $kode)->firstOrFail();
        $user = $request->user();
        $reportKode = $request->input('report_kode');

        $laporan = LaporanBarangHilang::where('kode', $reportKode)->firstOrFail();

        // Create match record
        $existing = PencocokanKandidat::where('laporan_id', $laporan->id)
            ->where('barang_temuan_id', $bt->id)->first();

        if (!$existing) {
            PencocokanKandidat::create([
                'laporan_id'       => $laporan->id,
                'barang_temuan_id' => $bt->id,
                'skor_kecocokan'   => 80,
                'status_cocok'     => 'pending',
            ]);
        }

        if (in_array($laporan->status, ['diterima', 'pencarian'])) {
            $laporan->update(['status' => 'kandidat']);
            RiwayatLaporan::create([
                'laporan_id' => $laporan->id,
                'waktu'      => now()->format('H:i'),
                'keterangan' => "Ditautkan manual ke {$kode} oleh {$user->name}",
            ]);
        }

        AuditLog::record($user->id, $user->name . ' (CS)', 'Cocokkan manual', "{$kode} → {$reportKode}");

        return response()->json(['ok' => true]);
    }

    /**
     * POST /api/staff/cs/claims/{id}/verify — Approve or reject a claim.
     */
    public function verifyClaim(Request $request, int $id)
    {
        $user = $request->user();

        if ($id < 0) {
            // Direct verification of a newly submitted passenger report (LaporanBarangHilang)
            $laporan = LaporanBarangHilang::with(['detailBarang.kategori', 'stasiunKe', 'stasiunDari'])->findOrFail(abs($id));
            $firstItem = $laporan->detailBarang->first();

            // Check if report already has a matched found item, or create/find one in warehouse
            $existingMatch = $laporan->pencocokan()->with('barangTemuan')->first();
            $bt = $existingMatch?->barangTemuan;

            if (!$bt) {
                $lastNum = BarangTemuan::max('id') ?? 0;
                $btKode = 'FND-' . str_pad($lastNum + 420, 4, '0', STR_PAD_LEFT);
                $bt = BarangTemuan::create([
                    'kode'              => $btKode,
                    'petugas_id'        => $user->id,
                    'stasiun_temuan_id' => $laporan->stasiun_ke_id ?? $laporan->stasiun_dari_id,
                    'kategori_id'       => $firstItem?->kategori_id ?? 1,
                    'nama_barang'       => $firstItem?->nama_barang ?? 'Barang Temuan',
                    'warna'             => $firstItem?->warna ?? 'Hitam',
                    'tanggal_temuan'    => now()->toDateString(),
                    'waktu_temuan'      => now()->format('H:i'),
                    'status_simpan'     => 'Dalam Klaim',
                    'expires_in'        => 30,
                    'secret'            => [
                        'detail' => $laporan->ciri_rahasia ?: 'Sesuai laporan penumpang',
                        'serial' => '-',
                        'locker' => 'Loker Posko CS',
                        'notes'  => 'Diverifikasi langsung dari laporan #' . $laporan->kode,
                    ],
                ]);

                PencocokanKandidat::firstOrCreate(
                    ['laporan_id' => $laporan->id, 'barang_temuan_id' => $bt->id],
                    ['skor_kecocokan' => 95, 'status_cocok' => 'pending']
                );
            }

            $klaim = KlaimVerifikasi::firstOrCreate(
                ['laporan_id' => $laporan->id, 'barang_temuan_id' => $bt->id],
                [
                    'kode'              => KlaimVerifikasi::generateKode(),
                    'jawaban_rahasia'   => $laporan->ciri_rahasia ?: 'Sesuai deskripsi laporan',
                    'status_verifikasi' => 'menunggu',
                ]
            );
            $klaim->load(['laporan', 'barangTemuan']);
        } else {
            $klaim = KlaimVerifikasi::with(['laporan', 'barangTemuan'])->findOrFail($id);
        }

        $rawAction = $request->input('action') ?? $request->input('decision');
        $action = match ($rawAction) {
            'approve', 'disetujui' => 'approve',
            'reject', 'ditolak'    => 'reject',
            'info', 'perlu_info'   => 'info',
            default                => $rawAction,
        };

        if ($action === 'approve') {
            // Approve: create BAST, update statuses
            $klaim->update([
                'status_verifikasi' => 'disetujui',
                'verified_by'       => $user->id,
                'catatan_cs'        => $request->input('note', ''),
            ]);

            // Create BAST
            $bastKode = BastPengambilan::generateKode();
            $qrPayload = $bastKode . '-' . Str::upper(Str::random(4));

            $bast = BastPengambilan::create([
                'kode'            => $bastKode,
                'klaim_id'        => $klaim->id,
                'kode_qr'         => $qrPayload,
                'metode_ambil'    => 'stasiun',
                'stasiun_ambil_id' => $klaim->barangTemuan->stasiun_temuan_id,
            ]);

            // Update report status
            $klaim->laporan->update(['status' => 'bast']);
            RiwayatLaporan::create([
                'laporan_id' => $klaim->laporan->id,
                'waktu'      => now()->format('H:i'),
                'keterangan' => "Klaim disetujui. BAST {$bastKode} terbit.",
            ]);

            // Update found item status
            $klaim->barangTemuan->update(['status_simpan' => 'Dalam Klaim']);

            AuditLog::record($user->id, $user->name . ' (CS)', 'Setujui klaim & terbitkan BAST', "{$klaim->kode} • BAST {$bastKode}");

            return response()->json([
                'claim'   => $this->mapClaim($klaim->fresh(['laporan.detailBarang.kategori', 'laporan.user', 'barangTemuan', 'verifier'])),
                'bast'    => $bastKode,
                'bast_id' => $bast->id,
                'qr'      => $qrPayload,
            ]);

        } elseif ($action === 'reject') {
            $request->validate(['note' => 'required|string|min:15']);

            $klaim->update([
                'status_verifikasi' => 'ditolak',
                'verified_by'       => $user->id,
                'catatan_cs'        => $request->input('template', '') . ': ' . $request->input('note'),
            ]);

            $klaim->laporan->update(['status' => 'ditolak']);

            RiwayatLaporan::create([
                'laporan_id' => $klaim->laporan->id,
                'waktu'      => now()->format('H:i'),
                'keterangan' => 'Klaim ditolak: ' . $request->input('note'),
            ]);

            AuditLog::record($user->id, $user->name . ' (CS)', 'Tolak klaim', $klaim->kode, 'Ditolak: ' . $request->input('template', 'Ciri tidak sesuai'));

            return response()->json([
                'claim' => $this->mapClaim($klaim->fresh(['laporan.detailBarang.kategori', 'laporan.user', 'barangTemuan', 'verifier'])),
            ]);

        } elseif ($action === 'info') {
            $klaim->laporan->update(['status' => 'perlu_info']);

            RiwayatLaporan::create([
                'laporan_id' => $klaim->laporan->id,
                'waktu'      => now()->format('H:i'),
                'keterangan' => 'Info tambahan diminta: ' . $request->input('message', ''),
            ]);

            AuditLog::record($user->id, $user->name . ' (CS)', 'Minta info tambahan', $klaim->kode);

            return response()->json(['ok' => true]);
        }

        return response()->json(['message' => 'Aksi tidak valid.'], 422);
    }

    /**
     * POST /api/staff/cs/bast/handover — Scan QR to complete handover.
     */
    public function handover(Request $request)
    {
        $qr = $request->input('qr_code');
        $user = $request->user();

        // Try to find BAST by QR code or by manual code
        $bast = BastPengambilan::where('kode_qr', $qr)
            ->orWhere('kode', $qr)
            ->first();

        if (!$bast) {
            return response()->json(['result' => 'invalid', 'message' => 'QR tidak valid.'], 404);
        }

        $klaim = $bast->klaim;
        if (!$klaim) {
            return response()->json(['result' => 'invalid', 'message' => 'Data klaim tidak ditemukan.'], 404);
        }

        $laporan = $klaim->laporan;

        // Check if already used
        if ($bast->waktu_serah_terima) {
            return response()->json([
                'result'  => 'used',
                'message' => 'BAST sudah digunakan pada ' . $bast->waktu_serah_terima->format('d M, H:i') . '.',
            ]);
        }

        // Check if shipping method
        if ($bast->metode_ambil === 'ekspedisi') {
            return response()->json([
                'result'  => 'shipping',
                'message' => 'Barang ini dijadwalkan dikirim via ekspedisi, bukan diambil di stasiun.',
            ]);
        }

        // Valid — return BAST details for confirmation
        if (!$request->boolean('confirm')) {
            $owner = $laporan->user;
            $barang = $klaim->barangTemuan;

            return response()->json([
                'result' => 'valid',
                'bast'   => [
                    'kode'   => $bast->kode,
                    'owner'  => $owner ? $owner->name : 'Unknown',
                    'item'   => $barang ? "{$barang->kode} • {$barang->nama_barang}" : '',
                    'locker' => $barang?->secret['locker'] ?? '',
                    'method' => $bast->metode_ambil,
                ],
            ]);
        }

        // Confirm handover
        $bast->update(['waktu_serah_terima' => now()]);
        $laporan->update(['status' => 'selesai']);

        $barang = $klaim->barangTemuan;
        if ($barang) {
            $barang->update(['status_simpan' => 'Selesai']);
        }

        RiwayatLaporan::create([
            'laporan_id' => $laporan->id,
            'waktu'      => now()->format('H:i'),
            'keterangan' => "Serah terima selesai. BAST {$bast->kode} oleh {$user->name}.",
        ]);

        AuditLog::record($user->id, $user->name . ' (CS)', 'Serah terima BAST', $bast->kode);

        return response()->json([
            'result'  => 'done',
            'message' => "BAST {$bast->kode} berstatus Selesai.",
        ]);
    }

    /**
     * GET /api/staff/cs/reports — Active reports for matching panel.
     */
    public function activeReports(Request $request)
    {
        $q = $request->input('q', '');
        $cat = $request->input('cat');

        $query = LaporanBarangHilang::whereIn('status', ['diterima', 'pencarian', 'kandidat'])
            ->with(['detailBarang.kategori', 'user', 'stasiunDari', 'stasiunKe']);

        if ($q) {
            $query->where(function ($qb) use ($q) {
                $qb->where('kode', 'ilike', "%{$q}%")
                    ->orWhereHas('detailBarang', function ($d) use ($q) {
                        $d->where('nama_barang', 'ilike', "%{$q}%");
                    });
            });
        }

        if ($cat) {
            $query->whereHas('detailBarang.kategori', function ($d) use ($cat) {
                $d->where('nama', $cat);
            });
        }

        $reports = $query->orderByDesc('created_at')->limit(20)->get();

        return response()->json($reports->map(function ($r) {
            $item = $r->detailBarang->first();
            $userName = $r->user ? $r->user->name : 'Anonymous';
            // Mask name for privacy
            $parts = explode(' ', $userName);
            $masked = ($parts[0][0] ?? '') . '. ' . implode('', array_map(fn($p) => substr($p, 0, 1) . str_repeat('*', max(0, strlen($p) - 1)), array_slice($parts, 1)));

            return [
                'id'    => $r->kode,
                'who'   => $masked,
                'desc'  => $item ? $item->nama_barang : '',
                'route' => ($r->stasiunDari?->nama ?? '') . ' ⟶ ' . ($r->stasiunKe?->nama ?? ''),
                'score' => 'Sedang',
            ];
        }));
    }

    // ---- Helpers ----

    private function mapInventoryItem(BarangTemuan $bt): array
    {
        return [
            'id'        => $bt->id,
            'code'      => $bt->kode,
            'cat'       => $bt->kategori?->nama ?? '',
            'name'      => $bt->nama_barang,
            'color'     => $bt->warna,
            'station'   => $bt->stasiunTemuan?->nama ?? '',
            'found'     => $bt->tanggal_temuan?->format('j M Y') . ', ' . ($bt->waktu_temuan ?? ''),
            'status'    => $bt->status_simpan,
            'expiresIn' => $bt->expires_in,
            'secret'    => $bt->secret ?? ['detail' => '', 'serial' => '-', 'locker' => '', 'notes' => ''],
        ];
    }

    private function mapClaim(KlaimVerifikasi $k): array
    {
        $laporan = $k->laporan;
        $barang = $k->barangTemuan;
        $item = $laporan?->detailBarang?->first();
        $user = $laporan?->user;

        // Mask reporter name
        $name = $user ? $user->name : 'Anonymous';
        $parts = explode(' ', $name);
        $masked = ($parts[0][0] ?? '') . '. ' . implode(' ', array_map(fn($p) => substr($p, 0, 1) . str_repeat('*', max(0, strlen($p) - 1)), array_slice($parts, 1)));

        // Map status to tab
        $tabMap = [
            'menunggu'  => 'baru',
            'disetujui' => 'selesai',
            'ditolak'   => 'selesai',
        ];

        // SLA: minutes since creation
        $slaMin = (int) now()->diffInMinutes($k->created_at);

        return [
            'id'        => $k->id,
            'no'        => $k->kode,
            'reporter'  => $masked,
            'item'      => $item ? $item->nama_barang : ($barang ? $barang->nama_barang : ''),
            'itemCode'  => $barang?->kode ?? '',
            'submitted' => $k->created_at->format('H:i'),
            'slaMin'    => max(0, 120 - $slaMin),
            'handler'   => $k->verifier ? $k->verifier->name : null,
            'tab'       => $tabMap[$k->status_verifikasi] ?? 'baru',
            'status'    => $k->status_verifikasi,
            'answer'    => $k->jawaban_rahasia ?: ($laporan?->ciri_rahasia ?? ''),
            'note'      => $k->catatan_cs,
        ];
    }

    private function mapReportAsClaim(LaporanBarangHilang $laporan): array
    {
        $item = $laporan->detailBarang->first();
        $user = $laporan->user;
        $matchedBt = $laporan->pencocokan->first()?->barangTemuan;

        $name = $user ? $user->name : 'Penumpang';
        $parts = explode(' ', $name);
        $masked = ($parts[0][0] ?? '') . '. ' . implode(' ', array_map(fn($p) => substr($p, 0, 1) . str_repeat('*', max(0, strlen($p) - 1)), array_slice($parts, 1)));

        $slaMin = (int) now()->diffInMinutes($laporan->created_at);

        $tab = match ($laporan->status) {
            'perlu_info' => 'info',
            'ditinjau'   => 'ditinjau',
            default      => 'baru',
        };

        return [
            'id'        => -1 * $laporan->id,
            'no'        => $laporan->kode,
            'reporter'  => trim($masked) ?: $name,
            'item'      => $item ? $item->nama_barang : 'Barang Hilang',
            'itemCode'  => $matchedBt?->kode ?? ('St. ' . ($laporan->stasiunKe?->nama ?? 'Manggarai')),
            'submitted' => $laporan->created_at->format('H:i'),
            'slaMin'    => max(0, 120 - $slaMin),
            'handler'   => null,
            'tab'       => $tab,
            'status'    => 'menunggu',
            'answer'    => $laporan->ciri_rahasia ?: "Posisi: {$laporan->posisi_terakhir} ({$laporan->stasiunDari?->nama} → {$laporan->stasiunKe?->nama})",
            'note'      => null,
        ];
    }
}
