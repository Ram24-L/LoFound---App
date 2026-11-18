<?php

namespace Tests\Feature;

use App\Models\BarangTemuan;
use App\Models\BastPengambilan;
use App\Models\KategoriBarang;
use App\Models\KlaimVerifikasi;
use App\Models\LaporanBarangHilang;
use App\Models\PencocokanKandidat;
use App\Models\Stasiun;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

class LoFoundEndToEndTest extends TestCase
{
    use DatabaseTransactions;
    /**
     * Test complete lifecycle of Lost & Found:
     * 1. Passenger creates lost report (POST /api/reports) -> status: diterima
     * 2. CS Staff records matching found item (POST /api/staff/cs/found-items) -> report auto-matched & status: kandidat
     * 3. Passenger submits claim verification (POST /api/reports/{id}/claim) -> status: ditinjau
     * 4. CS Staff approves claim (POST /api/staff/cs/claims/{id}/verify) -> BAST generated & status: bast
     * 5. CS Staff confirms BAST QR handover (POST /api/staff/cs/bast/handover) -> status: selesai
     */
    public function test_complete_lost_and_found_lifecycle(): void
    {
        // 0. Setup users
        $passenger = User::where('role', 'penumpang')->first();
        if (!$passenger) {
            $passenger = User::create([
                'name'     => 'Testing Penumpang',
                'email'    => 'test.penumpang@lofound.test',
                'password' => bcrypt('password'),
                'role'     => 'penumpang',
                'phone'    => '081234567890',
            ]);
        }

        $csStaff = User::where('email', 'rina.k@kci.id')->first();
        if (!$csStaff) {
            $csStaff = User::where('role', 'cs')->first() ?? User::create([
                'name'     => 'Rina Kusuma',
                'email'    => 'rina.k@kci.id',
                'password' => bcrypt('lofound2026'),
                'role'     => 'cs',
                'stasiun_id' => 6,
            ]);
        }

        // ==========================================
        // 1. Penumpang membuat laporan kehilangan
        // ==========================================
        $reportPayload = [
            'items' => [
                [
                    'name'     => 'Sony WH-1000XM5 Black Test',
                    'category' => 'Elektronik',
                    'sub'      => 'Headphone',
                    'color'    => 'Hitam',
                ],
            ],
            'from'     => 'Depok',
            'to'       => 'Manggarai',
            'date'     => now()->toDateString(),
            'time'     => '08:45',
            'position' => 'Gerbong 4 - Rak Bagasi Atas',
            'secret'   => 'Terdapat stiker logo KAI Commuter kecil di ear cup kiri',
            'notify'   => true,
        ];

        $reportRes = $this->actingAs($passenger)->postJson('/api/reports', $reportPayload);
        $reportRes->assertStatus(201);

        $reportData = $reportRes->json('report');
        $this->assertNotEmpty($reportData['id'], 'Report ID should be generated');
        $reportKode = $reportData['id'];

        $laporan = LaporanBarangHilang::where('kode', $reportKode)->first();
        $this->assertNotNull($laporan, 'Report model should exist in DB');
        $this->assertEquals('diterima', $laporan->status);

        // ==========================================
        // 2. Petugas CS menginput barang temuan yang cocok
        // ==========================================
        $uniqueSerial = 'SN-' . strtoupper(Str::random(8));
        $foundPayload = [
            'cat'     => 'Elektronik',
            'name'    => 'Headphone Sony WH-1000XM5 Hitam',
            'color'   => 'Hitam',
            'station' => 'Manggarai',
            'detail'  => 'Ear cup kiri ada stiker KAI Commuter',
            'serial'  => $uniqueSerial,
            'locker'  => 'Loker E2E-01',
            'notes'   => 'Ditemukan di rak bagasi atas peron 3',
        ];

        $foundRes = $this->actingAs($csStaff)->postJson('/api/staff/cs/found-items', $foundPayload);
        $foundRes->assertStatus(200);

        $foundData = $foundRes->json('item');
        $this->assertNotEmpty($foundData['code'], 'Found item code should be generated');
        $foundKode = $foundData['code'];

        // Reload report — status should have transitioned to 'kandidat' via auto-matching
        $laporan->refresh();
        $this->assertEquals('kandidat', $laporan->status, 'Report status should transition to kandidat');

        // Candidate match should exist
        $match = PencocokanKandidat::where('laporan_id', $laporan->id)
            ->whereHas('barangTemuan', fn ($q) => $q->where('kode', $foundKode))
            ->first();
        $this->assertNotNull($match, 'Candidate match record should be created');

        // ==========================================
        // 3. Penumpang mengajukan klaim verifikasi
        // ==========================================
        $claimPayload = [
            'candidates' => [$foundKode],
            'answers'    => [
                $foundKode => 'Stiker KAI Commuter kecil di ear cup kiri, bantalan busa warna hitam mulus.',
            ],
            'nik'        => '3201010101010001',
        ];

        $claimRes = $this->actingAs($passenger)->postJson("/api/reports/{$reportKode}/claim", $claimPayload);
        $claimRes->assertStatus(200);

        $laporan->refresh();
        $this->assertEquals('ditinjau', $laporan->status, 'Report status should become ditinjau');

        $klaim = KlaimVerifikasi::where('laporan_id', $laporan->id)->latest()->first();
        $this->assertNotNull($klaim, 'KlaimVerifikasi should be created');
        $this->assertEquals('menunggu', $klaim->status_verifikasi);

        // ==========================================
        // 4. Petugas CS menyetujui klaim (Approve)
        // ==========================================
        $verifyRes = $this->actingAs($csStaff)->postJson("/api/staff/cs/claims/{$klaim->id}/verify", [
            'action' => 'approve',
            'note'   => 'Verifikasi buta cocok sempurna dengan ciri ear cup dan nomor seri.',
        ]);
        $verifyRes->assertStatus(200);

        $bastKode = $verifyRes->json('bast');
        $this->assertNotEmpty($bastKode, 'BAST code should be returned upon approval');

        $laporan->refresh();
        $this->assertEquals('bast', $laporan->status, 'Report status should become bast');

        $klaim->refresh();
        $this->assertEquals('disetujui', $klaim->status_verifikasi);

        $bast = BastPengambilan::where('klaim_id', $klaim->id)->first();
        $this->assertNotNull($bast, 'BAST record should exist in DB');
        $this->assertNotEmpty($bast->kode_qr, 'BAST QR code should be generated');

        // ==========================================
        // 5. Serah terima BAST selesai (QR Scan)
        // ==========================================
        // Scan without confirm returns validation info
        $previewRes = $this->actingAs($csStaff)->postJson('/api/staff/cs/bast/handover', [
            'qr_code' => $bast->kode_qr,
            'confirm' => false,
        ]);
        $previewRes->assertStatus(200);
        $this->assertEquals('valid', $previewRes->json('result'));

        // Scan with confirm: true finalizes handover
        $handoverRes = $this->actingAs($csStaff)->postJson('/api/staff/cs/bast/handover', [
            'qr_code' => $bast->kode_qr,
            'confirm' => true,
        ]);
        $handoverRes->assertStatus(200);
        $this->assertEquals('done', $handoverRes->json('result'));

        // Final status verifications
        $laporan->refresh();
        $this->assertEquals('selesai', $laporan->status, 'Report status should be selesai');

        $bast->refresh();
        $this->assertNotNull($bast->waktu_serah_terima, 'BAST handover timestamp should be recorded');

        $barangTemuan = BarangTemuan::where('kode', $foundKode)->first();
        $this->assertEquals('Selesai', $barangTemuan->status_simpan, 'Found item storage status should be Selesai');
    }

    /**
     * Test Staff RBAC access enforcement:
     * - Penumpang cannot access staff CS dashboard (403)
     * - CS cannot access Manager analytics stats (403)
     */
    public function test_staff_rbac_middleware(): void
    {
        $passenger = User::where('role', 'penumpang')->first();
        $csStaff   = User::where('role', 'cs')->first();

        // 1. Passenger forbidden on staff routes
        $resPassenger = $this->actingAs($passenger)->getJson('/api/staff/cs/dashboard');
        $resPassenger->assertStatus(403);

        // 2. CS staff forbidden on Manager stats
        $resCs = $this->actingAs($csStaff)->getJson('/api/staff/manager/stats');
        $resCs->assertStatus(403);
    }
}
