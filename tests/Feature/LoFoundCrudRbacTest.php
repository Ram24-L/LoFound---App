<?php

namespace Tests\Feature;

use App\Models\BastPengambilan;
use App\Models\DetailBarangHilang;
use App\Models\KategoriBarang;
use App\Models\KlaimVerifikasi;
use App\Models\LaporanBarangHilang;
use App\Models\PencocokanKandidat;
use App\Models\RiwayatLaporan;
use App\Models\Stasiun;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class LoFoundCrudRbacTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        // Ensure master data exists if DB is fresh
        if (Stasiun::count() === 0) {
            $this->seed(\Database\Seeders\DatabaseSeeder::class);
        }
    }

    private function getOrCreatePassenger(string $email = 'ramdhan@mail.com', string $name = 'M. Ramdhan Maulana'): User
    {
        return User::firstOrCreate(
            ['email' => $email],
            [
                'name'     => $name,
                'phone'    => '0812' . rand(10000000, 99999999),
                'password' => Hash::make('password'),
                'role'     => 'penumpang',
            ]
        );
    }

    private function getOrCreateStaff(string $role, string $email, string $name): User
    {
        $stasiun = Stasiun::first();

        return User::firstOrCreate(
            ['email' => $email],
            [
                'name'       => $name,
                'password'   => Hash::make('lofound2026'),
                'role'       => $role,
                'stasiun_id' => $stasiun?->id,
            ]
        );
    }

    /**
     * TC-01 (Read Home & Public Stats):
     * GET /api/home-stats mengembalikan 200 OK dengan struktur metrik rasio kembali dan daftar riwayat barang kembali.
     */
    public function test_tc01_read_home_and_public_stats(): void
    {
        $res = $this->getJson('/api/home-stats');

        $res->assertStatus(200)
            ->assertJsonStructure([
                'total',
                'returned',
                'ratio',
                'in_progress',
                'feed',
            ]);

        $feedRes = $this->getJson('/api/home-feed');
        $feedRes->assertStatus(200);
        $this->assertIsArray($feedRes->json());
    }

    /**
     * TC-02 (Create Report & Auto-History):
     * Penumpang login membuat laporan baru via POST /api/reports.
     * Pastikan tersimpan di laporan_barang_hilang, detail_barang_hilang, riwayat_laporan,
     * serta mengembalikan JSON berformat Report.
     */
    public function test_tc02_create_report_and_auto_history(): void
    {
        $passenger = $this->getOrCreatePassenger();

        $payload = [
            'items' => [
                [
                    'name'     => 'iPad Air M2 Space Gray',
                    'category' => 'Elektronik',
                    'color'    => 'Hitam',
                ],
                [
                    'name'     => 'Tumbler Corkcicle Hitam',
                    'category' => 'Non Elektronik',
                    'color'    => 'Hitam',
                ],
            ],
            'from'     => 'Bogor',
            'to'       => 'Manggarai',
            'date'     => '2026-11-02',
            'time'     => '09:30',
            'position' => 'Gerbong 3 - Rak Atas',
            'secret'   => 'Ada stiker Apple warna hitam dan goresan kecil di sudut kiri.',
            'notify'   => true,
        ];

        $res = $this->actingAs($passenger)->postJson('/api/reports', $payload);

        $res->assertStatus(201)
            ->assertJsonStructure([
                'report' => [
                    'id',
                    'items' => [
                        '*' => ['sub', 'name', 'category', 'color'],
                    ],
                    'from',
                    'to',
                    'date',
                    'time',
                    'position',
                    'secret',
                    'status',
                    'candidates',
                    'notify',
                    'history' => [
                        '*' => ['t', 'text'],
                    ],
                    'updated',
                ],
            ]);

        $report = $res->json('report');
        $this->assertEquals('Bogor', $report['from']);
        $this->assertEquals('Manggarai', $report['to']);
        $this->assertCount(2, $report['items']);
        $this->assertEquals('A', $report['items'][0]['sub']);
        $this->assertEquals('B', $report['items'][1]['sub']);
        $this->assertNotEmpty($report['history']);
        $this->assertEquals('Dibuat', $report['history'][0]['text']);

        // Verify persistence in PostgreSQL
        $dbLaporan = LaporanBarangHilang::where('kode', $report['id'])->first();
        $this->assertNotNull($dbLaporan);
        $this->assertEquals(2, DetailBarangHilang::where('laporan_id', $dbLaporan->id)->count());
        $this->assertEquals(1, RiwayatLaporan::where('laporan_id', $dbLaporan->id)->count());
    }

    /**
     * TC-03 (Duplicate Detection):
     * POST /api/reports/check-duplicate dengan kategori, stasiun asal, stasiun tujuan,
     * dan tanggal yang sama dengan laporan aktif milik user mengembalikan flag duplicate: true.
     */
    public function test_tc03_duplicate_detection(): void
    {
        $passenger = $this->getOrCreatePassenger();

        $this->actingAs($passenger)->postJson('/api/reports', [
            'items'    => [['name' => 'MacBook Pro 14 Inch Silver', 'category' => 'Elektronik', 'color' => 'Silver']],
            'from'     => 'Depok',
            'to'       => 'Jakarta Kota',
            'date'     => '2026-11-10',
            'time'     => '08:15',
            'position' => 'Gerbong 5',
            'secret'   => 'Serial number berakhir 99AB',
        ])->assertStatus(201);

        $dupRes = $this->actingAs($passenger)->postJson('/api/reports/check-duplicate', [
            'from'     => 'Depok',
            'to'       => 'Jakarta Kota',
            'date'     => '2026-11-10',
            'time'     => '08:30',
            'category' => 'Elektronik',
        ]);

        $dupRes->assertStatus(200);
        $this->assertTrue((bool) $dupRes->json('duplicate'));
        $this->assertNotNull($dupRes->json('report'));
    }

    /**
     * TC-04 (Read User Reports & Filtering):
     * GET /api/reports mengembalikan daftar laporan milik user yang sedang login lengkap dengan
     * relasi items dan history, dan tidak membocorkan laporan milik penumpang lain.
     */
    public function test_tc04_read_user_reports_and_filtering(): void
    {
        $userA = $this->getOrCreatePassenger('user.a@mail.com', 'Penumpang Satu');
        $userB = $this->getOrCreatePassenger('user.b@mail.com', 'Penumpang Dua');

        $resA = $this->actingAs($userA)->postJson('/api/reports', [
            'items'    => [['name' => 'Kamera Fujifilm X100V', 'category' => 'Elektronik', 'color' => 'Silver']],
            'from'     => 'Bogor',
            'to'       => 'Sudirman',
            'date'     => '2026-11-12',
            'time'     => '10:00',
            'position' => 'Gerbong 2',
            'secret'   => 'Tali strap warna hijau army',
        ])->assertStatus(201);
        $kodeA = $resA->json('report.id');

        $resB = $this->actingAs($userB)->postJson('/api/reports', [
            'items'    => [['name' => 'Dompet Braun Buffel Hitam', 'category' => 'Non Elektronik', 'color' => 'Hitam']],
            'from'     => 'Bekasi',
            'to'       => 'Manggarai',
            'date'     => '2026-11-12',
            'time'     => '11:00',
            'position' => 'Gerbong 1',
            'secret'   => 'Ada KTP atas nama Penumpang Dua',
        ])->assertStatus(201);
        $kodeB = $resB->json('report.id');

        $listA = $this->actingAs($userA)->getJson('/api/reports');
        $listA->assertStatus(200);

        $idsForA = collect($listA->json())->pluck('id')->toArray();
        $this->assertContains($kodeA, $idsForA);
        $this->assertNotContains($kodeB, $idsForA);

        $foundReportA = collect($listA->json())->firstWhere('id', $kodeA);
        $this->assertNotEmpty($foundReportA['items']);
        $this->assertNotEmpty($foundReportA['history']);
    }

    /**
     * TC-05 (Update Report & Locked Fields):
     * PATCH /api/reports/{id} berhasil mengubah name, color, position, dan secret ketika status
     * masih diterima atau pencarian, serta menambah record baru di riwayat_laporan.
     * Tolak perubahan (403/422) jika status laporan sudah selesai atau dibatalkan.
     */
    public function test_tc05_update_report_and_locked_fields(): void
    {
        $passenger = $this->getOrCreatePassenger();

        $createRes = $this->actingAs($passenger)->postJson('/api/reports', [
            'items'    => [['name' => 'Tas Ransel Eiger Lama', 'category' => 'Non Elektronik', 'color' => 'Hitam']],
            'from'     => 'Bogor',
            'to'       => 'Manggarai',
            'date'     => '2026-11-11',
            'time'     => '07:30',
            'position' => 'Gerbong 1',
            'secret'   => 'Gantungan kunci kompas kecil',
        ])->assertStatus(201);

        $kode = $createRes->json('report.id');

        // Update while status is 'diterima'
        $patchRes = $this->actingAs($passenger)->patchJson("/api/reports/{$kode}", [
            'name'     => 'Tas Ransel Eiger Baru 25L',
            'color'    => 'Biru',
            'position' => 'Gerbong 4 - Dekat Pintu',
            'secret'   => 'Gantungan kunci kompas kecil dan botol minum biru',
        ]);

        $patchRes->assertStatus(200);
        $this->assertEquals('Tas Ransel Eiger Baru 25L', $patchRes->json('report.items.0.name'));
        $this->assertEquals('Biru', $patchRes->json('report.items.0.color'));
        $this->assertEquals('Gerbong 4 - Dekat Pintu', $patchRes->json('report.position'));
        $this->assertGreaterThanOrEqual(2, count($patchRes->json('report.history')));

        // Mark report as 'selesai' and verify update is rejected
        $laporan = LaporanBarangHilang::where('kode', $kode)->first();
        $laporan->update(['status' => 'selesai']);

        $lockedRes = $this->actingAs($passenger)->patchJson("/api/reports/{$kode}", [
            'name' => 'Tidak Boleh Berubah',
        ]);
        $this->assertContains($lockedRes->status(), [403, 422]);

        // Mark report as 'dibatalkan' and verify update is rejected
        $laporan->update(['status' => 'dibatalkan']);
        $cancelledRes = $this->actingAs($passenger)->patchJson("/api/reports/{$kode}", [
            'name' => 'Tidak Boleh Berubah Juga',
        ]);
        $this->assertContains($cancelledRes->status(), [403, 422]);
    }

    /**
     * TC-06 (Merge 2 Reports):
     * POST /api/reports/merge dengan 2 ID laporan yang memiliki from, to, dan date yang sama
     * berhasil menggabungkan items ke laporan pertama (jumlah items menjadi 2) dan menonaktifkan laporan kedua.
     * Tolak jika rute atau tanggal berbeda.
     */
    public function test_tc06_merge_two_reports(): void
    {
        $passenger = $this->getOrCreatePassenger();

        $r1 = $this->actingAs($passenger)->postJson('/api/reports', [
            'items' => [['name' => 'Laptop Asus Zenbook 14', 'category' => 'Elektronik', 'color' => 'Silver']],
            'from'  => 'Bogor',
            'to'    => 'Jakarta Kota',
            'date'  => '2026-11-14',
            'time'  => '08:00',
        ])->json('report.id');

        $r2 = $this->actingAs($passenger)->postJson('/api/reports', [
            'items' => [['name' => 'Payung Lipat Hitam Polos', 'category' => 'Non Elektronik', 'color' => 'Hitam']],
            'from'  => 'Bogor',
            'to'    => 'Jakarta Kota',
            'date'  => '2026-11-14',
            'time'  => '08:05',
        ])->json('report.id');

        $rDiff = $this->actingAs($passenger)->postJson('/api/reports', [
            'items' => [['name' => 'Jaket Parasut Biru Navy', 'category' => 'Non Elektronik', 'color' => 'Biru']],
            'from'  => 'Depok',
            'to'    => 'Tanah Abang',
            'date'  => '2026-11-15',
            'time'  => '09:00',
        ])->json('report.id');

        // Reject merge when route/date differ
        $badMerge = $this->actingAs($passenger)->postJson('/api/reports/merge', [
            'ids' => [$r1, $rDiff],
        ]);
        $badMerge->assertStatus(422);

        // Succeed merge when route & date match
        $goodMerge = $this->actingAs($passenger)->postJson('/api/reports/merge', [
            'ids' => [$r1, $r2],
        ]);
        $goodMerge->assertStatus(200);
        $this->assertCount(2, $goodMerge->json('report.items'));
        $this->assertEquals('A', $goodMerge->json('report.items.0.sub'));
        $this->assertEquals('B', $goodMerge->json('report.items.1.sub'));

        $lap2 = LaporanBarangHilang::where('kode', $r2)->first();
        $this->assertEquals('dibatalkan', $lap2->status);
    }

    /**
     * TC-07 (Cancel & Reactivate Report):
     * - POST /api/reports/cancel berhasil membatalkan laporan berstatus pencarian beserta alasan pembatalan.
     * - Tolak pembatalan jika laporan sudah berstatus verifikasi/ditinjau, bast, atau dikirim.
     * - POST /api/reports/{id}/reactivate berhasil mengaktifkan kembali laporan yang dibatalkan menjadi pencarian.
     */
    public function test_tc07_cancel_and_reactivate_report(): void
    {
        $passenger = $this->getOrCreatePassenger();

        $kode = $this->actingAs($passenger)->postJson('/api/reports', [
            'items' => [['name' => 'Kacamata Baca Frame Hitam', 'category' => 'Non Elektronik', 'color' => 'Hitam']],
            'from'  => 'Cilebut',
            'to'    => 'Manggarai',
            'date'  => '2026-11-15',
            'time'  => '10:00',
        ])->json('report.id');

        $laporan = LaporanBarangHilang::where('kode', $kode)->first();
        $laporan->update(['status' => 'pencarian']);

        // Cancel report in 'pencarian' status
        $cancelRes = $this->actingAs($passenger)->postJson('/api/reports/cancel', [
            'ids'    => [$kode],
            'reason' => 'Barang sudah ditemukan sendiri di rumah',
        ]);
        $cancelRes->assertStatus(200);

        $laporan->refresh();
        $this->assertEquals('dibatalkan', $laporan->status);
        $this->assertEquals('Barang sudah ditemukan sendiri di rumah', $laporan->alasan_batal);

        // Reactivate cancelled report -> becomes 'pencarian'
        $reactivateRes = $this->actingAs($passenger)->postJson("/api/reports/{$kode}/reactivate");
        $reactivateRes->assertStatus(200);
        $this->assertEquals('pencarian', $reactivateRes->json('report.status'));

        // Reject cancellation when status is verifikasi/ditinjau, bast, or dikirim
        foreach (['ditinjau', 'verifikasi', 'bast', 'dikirim'] as $lockedStatus) {
            $laporan->update(['status' => $lockedStatus]);
            $rejectRes = $this->actingAs($passenger)->postJson('/api/reports/cancel', [
                'ids'    => [$kode],
                'reason' => 'Coba batalkan saat terkunci',
            ]);
            $this->assertContains($rejectRes->status(), [403, 422], "Cancellation should fail for status {$lockedStatus}");
        }
    }

    /**
     * TC-08 (Proteksi Guest & Penumpang ke Endpoint Staff):
     * Guest (belum login) dan user ber-role penumpang yang mengakses /api/staff/*
     * wajib mendapat response 401 Unauthorized atau 403 Forbidden.
     */
    public function test_tc08_guest_and_passenger_protection_on_staff_endpoints(): void
    {
        // Guest (unauthenticated) -> 401
        $this->getJson('/api/staff/cs/dashboard')->assertStatus(401);
        $this->getJson('/api/staff/logistics/inventory')->assertStatus(401);
        $this->getJson('/api/staff/admin/users')->assertStatus(401);
        $this->getJson('/api/staff/manager/stats')->assertStatus(401);

        // Logged-in Passenger -> 403
        $passenger = $this->getOrCreatePassenger();
        $this->actingAs($passenger)->getJson('/api/staff/cs/dashboard')->assertStatus(403);
        $this->actingAs($passenger)->getJson('/api/staff/logistics/inventory')->assertStatus(403);
        $this->actingAs($passenger)->getJson('/api/staff/admin/users')->assertStatus(403);
        $this->actingAs($passenger)->getJson('/api/staff/manager/stats')->assertStatus(403);
    }

    /**
     * TC-09 (Isolasi Role Antar-Petugas):
     * - Role cs BISA mengakses /api/staff/cs/*, DITOLAK (403) ke /api/staff/logistics/* dan /api/staff/admin/*.
     * - Role logistik BISA mengakses /api/staff/logistics/*, DITOLAK (403) saat memverifikasi klaim CS.
     * - Role admin BISA mengelola master data stasiun & user di /api/staff/admin/*.
     * - Role kepala_stasiun BISA mengakses analitik KPI di /api/staff/manager/*.
     */
    public function test_tc09_staff_role_isolation_rbac(): void
    {
        $cs       = $this->getOrCreateStaff('cs', 'rina.k@kci.id', 'Rina Kurniasih');
        $logistik = $this->getOrCreateStaff('logistik', 'agus.p@kci.id', 'Agus Pratama');
        $admin    = $this->getOrCreateStaff('admin', 'hendra.w@kci.id', 'Hendra Wijaya');
        $manager  = $this->getOrCreateStaff('kepala_stasiun', 'sutrisno@kci.id', 'Ir. Sutrisno');

        // CS role checks
        $this->actingAs($cs)->getJson('/api/staff/cs/dashboard')->assertStatus(200);
        $this->actingAs($cs)->getJson('/api/staff/logistics/inventory')->assertStatus(403);
        $this->actingAs($cs)->getJson('/api/staff/admin/users')->assertStatus(403);

        // Logistics role checks
        $this->actingAs($logistik)->getJson('/api/staff/logistics/inventory')->assertStatus(200);
        $this->actingAs($logistik)->postJson('/api/staff/cs/claims/1/verify', ['action' => 'approve'])->assertStatus(403);

        // Admin role checks (Users + Stations full CRUD)
        $this->actingAs($admin)->getJson('/api/staff/admin/users')->assertStatus(200);
        $this->actingAs($admin)->getJson('/api/staff/admin/stations')->assertStatus(200);
        $this->actingAs($admin)->postJson('/api/staff/admin/users', [
            'name'    => 'Petugas Baru Test',
            'email'   => 'petugas.' . Str::lower(Str::random(5)) . '@kci.id',
            'role'    => 'Petugas CS',
            'station' => 'Manggarai',
        ])->assertStatus(200);

        // Station CRUD: Create, Update/Hide, Delete
        $stCreate = $this->actingAs($admin)->postJson('/api/staff/admin/stations', [
            'code'   => 'TST' . rand(10, 99),
            'name'   => 'Cikini Test',
            'line'   => 'Lin Bogor',
            'hours'  => '04:00–24:00',
            'active' => true,
        ]);
        $stCreate->assertStatus(200);
        $stId = $stCreate->json('station.id');

        $stUpdate = $this->actingAs($admin)->patchJson("/api/staff/admin/stations/{$stId}", [
            'name'   => 'Cikini Baru',
            'active' => false,
        ]);
        $stUpdate->assertStatus(200);
        $this->assertFalse($stUpdate->json('station.active'));

        $stDelete = $this->actingAs($admin)->deleteJson("/api/staff/admin/stations/{$stId}");
        $stDelete->assertStatus(200);

        // Category CRUD: Create -> Appears in public /api/categories -> Delete
        $catCreate = $this->actingAs($admin)->postJson('/api/staff/admin/categories', [
            'name'      => 'Aksesoris Test ' . rand(10, 99),
            'retention' => 30,
            'shippable' => true,
        ]);
        $catCreate->assertStatus(200);
        $catId = $catCreate->json('category.id');
        $catName = $catCreate->json('category.name');

        $pubCats = collect($this->getJson('/api/categories')->json())->pluck('nama')->toArray();
        $this->assertContains($catName, $pubCats);

        $catDelete = $this->actingAs($admin)->deleteJson("/api/staff/admin/categories/{$catId}");
        $catDelete->assertStatus(200);

        // Kepala Stasiun (Manager) role checks
        $this->actingAs($manager)->getJson('/api/staff/manager/stats')
            ->assertStatus(200)
            ->assertJsonStructure(['kpis', 'series']);
    }

    /**
     * TC-10 (Integrasi End-to-End: Temuan -> Kandidat -> Klaim -> Verifikasi CS -> BAST -> Ekspedisi/Selesai):
     * 1. Petugas cs menginput barang temuan (POST /api/staff/cs/found-items) yang cocok -> status laporan menjadi kandidat & candidates > 0.
     * 2. Penumpang mengajukan klaim (POST /api/reports/{id}/claim) -> tersimpan di klaim_verifikasi dan status laporan menjadi ditinjau/verifikasi.
     * 3. Petugas cs menyetujui klaim (POST /api/staff/cs/claims/{claimId}/verify dengan decision: 'disetujui') -> terbit BAST ber-QR Code dan status = bast.
     * 4. Penumpang memilih pengiriman ekspedisi & membayar di POST /api/reports/{id}/bast -> Petugas logistik menginput resi di POST /api/staff/logistics/shipments/{bastId}/ship -> status = dikirim.
     */
    public function test_tc10_end_to_end_found_candidate_claim_verify_bast_shipping(): void
    {
        $passenger = $this->getOrCreatePassenger();
        $cs        = $this->getOrCreateStaff('cs', 'rina.k@kci.id', 'Rina Kurniasih');
        $logistik  = $this->getOrCreateStaff('logistik', 'agus.p@kci.id', 'Agus Pratama');

        // Step 0: Penumpang membuat laporan kehilangan
        $reportRes = $this->actingAs($passenger)->postJson('/api/reports', [
            'items' => [
                [
                    'name'     => 'Nintendo Switch OLED Putih',
                    'category' => 'Elektronik',
                    'color'    => 'Putih',
                ],
            ],
            'from'     => 'Depok',
            'to'       => 'Manggarai',
            'date'     => now()->toDateString(),
            'time'     => '08:20',
            'position' => 'Gerbong 4 - Rak Atas',
            'secret'   => 'Joy-Con kiri ada grip karet hitam dan case Zelda',
            'notify'   => true,
        ]);
        $reportRes->assertStatus(201);
        $reportKode = $reportRes->json('report.id');

        // Step 1: Petugas CS menginput barang temuan yang cocok
        $foundRes = $this->actingAs($cs)->postJson('/api/staff/cs/found-items', [
            'cat'     => 'Elektronik',
            'name'    => 'Konsol Nintendo Switch Putih',
            'color'   => 'Putih',
            'station' => 'Manggarai',
            'detail'  => 'Joy-Con kiri grip karet hitam, di dalam case Zelda',
            'serial'  => 'NSW-' . strtoupper(Str::random(8)),
            'locker'  => 'Loker A-09',
            'notes'   => 'Ditemukan petugas kebersihan di Manggarai',
        ]);
        $foundRes->assertStatus(200);
        $foundKode = $foundRes->json('item.code');
        $this->assertNotEmpty($foundKode);

        // Verify report transitioned to 'kandidat' and candidates > 0
        $laporan = LaporanBarangHilang::where('kode', $reportKode)->first();
        $this->assertEquals('kandidat', $laporan->status);
        $reportArr = $laporan->toReportArray();
        $this->assertGreaterThan(0, $reportArr['candidates']);

        // Step 2: Penumpang mengajukan klaim
        $claimRes = $this->actingAs($passenger)->postJson("/api/reports/{$reportKode}/claim", [
            'candidates' => [$foundKode],
            'answers'    => [
                $foundKode => 'Di dalam case Zelda terdapat Joy-Con kiri dengan grip karet warna hitam.',
            ],
            'nik'        => '3201123456780001',
        ]);
        $claimRes->assertStatus(200);

        $laporan->refresh();
        $this->assertContains($laporan->status, ['ditinjau', 'verifikasi']);

        $klaim = KlaimVerifikasi::where('laporan_id', $laporan->id)->latest()->first();
        $this->assertNotNull($klaim);
        $this->assertEquals('menunggu', $klaim->status_verifikasi);

        // Verify claim appears in CS dashboard queue
        $dashRes = $this->actingAs($cs)->getJson('/api/staff/cs/dashboard');
        $dashRes->assertStatus(200);
        $claimNos = collect($dashRes->json('claims'))->pluck('no')->toArray();
        $this->assertContains($klaim->kode, $claimNos);

        // Step 3: Petugas CS menyetujui klaim dengan decision: 'disetujui'
        $verifyRes = $this->actingAs($cs)->postJson("/api/staff/cs/claims/{$klaim->id}/verify", [
            'decision' => 'disetujui',
            'note'     => 'Seluruh ciri rahasia cocok 100% dengan barang di gudang.',
        ]);
        $verifyRes->assertStatus(200);

        $laporan->refresh();
        $this->assertEquals('bast', $laporan->status);

        $bast = BastPengambilan::where('klaim_id', $klaim->id)->first();
        $this->assertNotNull($bast);
        $this->assertNotEmpty($bast->kode_qr);

        // Step 4: Penumpang memilih pengiriman ekspedisi & membayar
        $bastChoiceRes = $this->actingAs($passenger)->postJson("/api/reports/{$reportKode}/bast", [
            'method'     => 'ekspedisi',
            'courier'    => 'KAI Logistik Express',
            'address'    => 'Jl. Margonda Raya No. 100',
            'city'       => 'Depok',
            'zip'        => '16424',
            'name'       => 'M. Ramdhan Maulana',
            'wa'         => '081234567890',
            'insure'     => true,
            'pay_method' => 'qris',
        ]);
        $bastChoiceRes->assertStatus(200);
        $bastId = $bastChoiceRes->json('bast_id') ?? $bast->id;

        // Petugas Logistik menginput nomor resi pengiriman
        $awbNumber = 'KALOG-' . strtoupper(Str::random(8));
        $shipRes = $this->actingAs($logistik)->postJson("/api/staff/logistics/shipments/{$bastId}/ship", [
            'awb'    => $awbNumber,
            'action' => 'ship',
        ]);
        $shipRes->assertStatus(200);

        $laporan->refresh();
        $bast->refresh();
        $this->assertEquals('dikirim', $laporan->status);
        $this->assertEquals($awbNumber, $bast->nomor_resi);

        // Step 5: Direct Report -> CS Queue -> Verify -> BAST Handover -> Selesai flow
        $directRes = $this->actingAs($passenger)->postJson('/api/reports', [
            'items' => [
                [
                    'name'     => 'AirPods Pro Gen 2 Case Putih',
                    'category' => 'Elektronik',
                    'color'    => 'Putih',
                ],
            ],
            'from'     => 'Bogor',
            'to'       => 'Jakarta Kota',
            'date'     => now()->toDateString(),
            'time'     => '10:45',
            'position' => 'Gerbong 2 - Kursi Tengah',
            'secret'   => 'Engraving nama RAMDHAN di bagian depan charging case',
            'notify'   => true,
        ]);
        $directRes->assertStatus(201);
        $directKode = $directRes->json('report.id');

        // Verify new report immediately appears in CS dashboard claims queue in real-time
        $csDash = $this->actingAs($cs)->getJson('/api/staff/cs/dashboard');
        $csDash->assertStatus(200);
        $directClaimEntry = collect($csDash->json('claims'))->firstWhere('no', $directKode);
        $this->assertNotNull($directClaimEntry, 'New passenger report should immediately appear in CS claims queue');

        // CS verifies & approves directly from the queue
        $directVerify = $this->actingAs($cs)->postJson("/api/staff/cs/claims/{$directClaimEntry['id']}/verify", [
            'action' => 'approve',
        ]);
        $directVerify->assertStatus(200);
        $directBastCode = $directVerify->json('bast');

        // Passenger report status automatically updates to 'bast'
        $directLaporan = LaporanBarangHilang::where('kode', $directKode)->first();
        $this->assertEquals('bast', $directLaporan->status);

        // CS completes handover at station -> Passenger report status becomes 'selesai'
        $handoverRes = $this->actingAs($cs)->postJson('/api/staff/cs/bast/handover', [
            'qr_code' => $directBastCode,
            'confirm' => true,
        ]);
        $handoverRes->assertStatus(200);
        $this->assertEquals('done', $handoverRes->json('result'));

        $directLaporan->refresh();
        $this->assertEquals('selesai', $directLaporan->status);

        // Step 6: Passenger Saved Address & Transaction History CRUD
        $addrRes = $this->actingAs($passenger)->patchJson('/api/auth/profile', [
            'nik'     => '3201999988887777',
            'address' => [
                'label' => 'Rumah',
                'name'  => 'M. Ramdhan',
                'wa'    => '081234567890',
                'addr'  => 'Jl. Margonda No. 10',
                'city'  => 'Depok',
                'zip'   => '16424',
            ],
        ]);
        $addrRes->assertStatus(200);
        $this->assertEquals('3201999988887777', $addrRes->json('user.nik'));
        $this->assertEquals('Jl. Margonda No. 10', $addrRes->json('user.address.addr'));

        $trxRes = $this->actingAs($passenger)->getJson('/api/transactions');
        $trxRes->assertStatus(200);
        $this->assertNotEmpty($trxRes->json());
    }

    /**
     * TC-11 (2-Stage Trust Model & Anti-Abuse Blind Candidates):
     * 1. Laporan baru (status diterima) mengembalikan [] di /candidates dan ditolak (422) jika langsung /claim.
     * 2. Setelah CS menautkan barang temuan via /match, /candidates mengembalikan kandidat termasking (tanpa nama_barang persis).
     * 3. Klaim barang tak tertaut ditolak (422); klaim barang tertaut berhasil (200) dan meng-hold barang temuan ('Dalam Klaim').
     * 4. Penolakan klaim oleh CS melepas kembali status barang temuan menjadi 'Tersimpan'.
     */
    public function test_tc11_two_stage_trust_anti_abuse_and_blind_candidates(): void
    {
        $passenger = $this->getOrCreatePassenger('trust.user@mail.com', 'Penumpang Trust');
        $cs        = $this->getOrCreateStaff('cs', 'rina.k@kci.id', 'Rina Kurniasih');

        // 1. CS records a warehouse item first
        $foundRes = $this->actingAs($cs)->postJson('/api/staff/cs/found-items', [
            'cat'     => 'Elektronik',
            'name'    => 'MacBook Pro M3 Space Black',
            'color'   => 'Hitam',
            'station' => 'Manggarai',
            'detail'  => 'Ada stiker unik KRL Commuter di pojok kiri',
            'serial'  => 'MBP-' . strtoupper(Str::random(6)),
            'locker'  => 'Loker C-01',
        ])->assertStatus(200);
        $foundKode = $foundRes->json('item.code');

        // Unrelated item in warehouse
        $otherRes = $this->actingAs($cs)->postJson('/api/staff/cs/found-items', [
            'cat'     => 'Elektronik',
            'name'    => 'iPhone 15 Pro Titanium',
            'color'   => 'Silver',
            'station' => 'Jakarta Kota',
            'detail'  => 'Case transparan',
            'serial'  => 'IPH-' . strtoupper(Str::random(6)),
            'locker'  => 'Loker C-02',
        ])->assertStatus(200);
        $otherKode = $otherRes->json('item.code');

        // 2. Passenger submits a generic Stage-1 report with an unrelated category first so it stays 'diterima'
        $repRes = $this->actingAs($passenger)->postJson('/api/reports', [
            'items'    => [['name' => 'Laptop Kerja Hitam', 'category' => 'Non Elektronik', 'color' => 'Hitam']],
            'from'     => 'Bogor',
            'to'       => 'Manggarai',
            'date'     => now()->toDateString(),
            'time'     => '09:00',
            'position' => 'Gerbong 4',
            'secret'   => 'Ada stiker unik KRL Commuter di pojok kiri atas',
        ])->assertStatus(201);
        $reportKode = $repRes->json('report.id');

        // Stage-1 check: candidates endpoint returns [] and direct claim is rejected (422)
        $this->actingAs($passenger)->getJson("/api/reports/{$reportKode}/candidates")
            ->assertStatus(200)
            ->assertExactJson([]);

        $this->actingAs($passenger)->postJson("/api/reports/{$reportKode}/claim", [
            'candidates' => [$foundKode],
            'answers'    => [$foundKode => 'Coba nebak barang temuan di gudang tanpa tautan CS'],
        ])->assertStatus(422);

        // 3. CS manually links the warehouse item -> report moves to 'kandidat'
        $this->actingAs($cs)->postJson("/api/staff/cs/found-items/{$foundKode}/match", [
            'report_kode' => $reportKode,
        ])->assertStatus(200);

        $candsRes = $this->actingAs($passenger)->getJson("/api/reports/{$reportKode}/candidates")
            ->assertStatus(200);
        $cands = $candsRes->json();
        $this->assertCount(1, $cands);
        $this->assertEquals($foundKode, $cands[0]['id']);
        $this->assertStringNotContainsString('MacBook Pro M3 Space Black', $cands[0]['desc']);

        // Claiming an unlinked warehouse item code is still rejected (422)
        $this->actingAs($passenger)->postJson("/api/reports/{$reportKode}/claim", [
            'candidates' => [$otherKode],
            'answers'    => [$otherKode => 'Mencoba klaim barang lain yang tidak ditautkan'],
        ])->assertStatus(422);

        // Claiming the CS-linked item succeeds and puts found item into 'Dalam Klaim'
        $claimRes = $this->actingAs($passenger)->postJson("/api/reports/{$reportKode}/claim", [
            'candidates' => [$foundKode],
            'answers'    => [$foundKode => 'Ada stiker unik KRL Commuter di pojok kiri laptop saya.'],
            'nik'        => '3201888877776666',
        ])->assertStatus(200);
        $claimId = $claimRes->json('claim_id');

        $bt = \App\Models\BarangTemuan::where('kode', $foundKode)->first();
        $this->assertEquals('Dalam Klaim', $bt->status_simpan);

        // 4. Rejecting the claim releases the found item back to 'Tersimpan'
        $this->actingAs($cs)->postJson("/api/staff/cs/claims/{$claimId}/verify", [
            'action' => 'reject',
            'note'   => 'Ciri rahasia belum cocok dengan kondisi fisik di gudang.',
        ])->assertStatus(200);

        $bt->refresh();
        $this->assertEquals('Tersimpan', $bt->status_simpan);
    }

    /**
     * TC-12 (Production Readiness: OTP Cache, Payment Webhook SHA-512, Real Notifications, Private KTP, Maintenance):
     */
    public function test_tc12_production_readiness_otp_webhooks_notifications_and_private_ktp(): void
    {
        $passenger = $this->getOrCreatePassenger('prod.user@mail.com', 'Penumpang Production');
        $otherUser = $this->getOrCreatePassenger('other.user@mail.com', 'Penumpang Lain');
        $cs        = $this->getOrCreateStaff('cs', 'rina.k@kci.id', 'Rina Kurniasih');

        // 1. Real OTP send & verify via Cache
        $otpSend = $this->postJson('/api/auth/otp/send', ['contact' => '081299990001']);
        $otpSend->assertStatus(200);
        $devOtp = $otpSend->json('dev_otp');
        $this->assertNotEmpty($devOtp);

        // Wrong OTP fails (422)
        $this->postJson('/api/auth/otp', ['phone' => '081299990001', 'otp' => '000000'])
            ->assertStatus(422);

        // Correct OTP succeeds (200)
        $this->postJson('/api/auth/otp', ['phone' => '081299990001', 'otp' => $devOtp])
            ->assertStatus(200)
            ->assertJsonStructure(['token', 'user']);

        // 2. Payment Webhook signature check & state transition
        $report = LaporanBarangHilang::create([
            'kode'             => LaporanBarangHilang::generateKode(),
            'user_id'          => $passenger->id,
            'stasiun_dari_id'  => Stasiun::first()->id,
            'stasiun_ke_id'    => Stasiun::first()->id,
            'tanggal_kejadian' => now()->toDateString(),
            'waktu_kejadian'   => '10:00',
            'posisi_terakhir'  => 'Gerbong 1',
            'ciri_rahasia'     => 'Ciri rahasia produksi terverifikasi',
            'status'           => 'bast',
            'notify'           => true,
        ]);

        $bt = \App\Models\BarangTemuan::first();
        $klaim = KlaimVerifikasi::create([
            'kode'              => KlaimVerifikasi::generateKode(),
            'laporan_id'        => $report->id,
            'barang_temuan_id'  => $bt->id,
            'jawaban_rahasia'   => 'Ciri rahasia produksi terverifikasi',
            'status_verifikasi' => 'disetujui',
        ]);

        $bast = BastPengambilan::create([
            'kode'         => BastPengambilan::generateKode(),
            'klaim_id'     => $klaim->id,
            'metode_ambil' => 'ekspedisi',
            'kurir'        => 'KAI Logistik Express',
            'ongkir'       => 25500,
            'status_bayar' => 'pending',
        ]);

        config()->set('services.midtrans.server_key', 'test-midtrans-secret');
        $invalidSigRes = $this->postJson('/api/webhooks/payment', [
            'order_id'           => $bast->kode,
            'status_code'        => '200',
            'gross_amount'       => '25500.00',
            'signature_key'      => 'invalid-sig',
            'transaction_status' => 'settlement',
        ]);
        $invalidSigRes->assertStatus(403);

        $validSig = hash('sha512', $bast->kode . '200' . '25500.00' . 'test-midtrans-secret');
        $validSigRes = $this->postJson('/api/webhooks/payment', [
            'order_id'           => $bast->kode,
            'status_code'        => '200',
            'gross_amount'       => '25500.00',
            'signature_key'      => $validSig,
            'transaction_status' => 'settlement',
        ]);
        $validSigRes->assertStatus(200);

        $bast->refresh();
        $report->refresh();
        $this->assertEquals('lunas', $bast->status_bayar);
        $this->assertEquals('dikirim', $report->status);

        // 3. Notifications API
        $this->actingAs($passenger)->getJson('/api/notifications')
            ->assertStatus(200)
            ->assertJsonFragment(['report_id' => $report->kode]);

        // 4. Private KTP Storage & Access Control
        \Illuminate\Support\Facades\Storage::fake('local');
        $file = \Illuminate\Http\UploadedFile::fake()->image('ktp.jpg');
        $upRes = $this->actingAs($passenger)->post('/api/upload', [
            'file'    => $file,
            'purpose' => 'ktp',
        ]);
        $upRes->assertStatus(200);
        $ktpUrl = $upRes->json('url');
        $this->assertStringStartsWith('/api/private-files/ktp/', $ktpUrl);

        $klaim->update(['bukti_tambahan' => $ktpUrl]);

        $this->actingAs($otherUser)->getJson($ktpUrl)->assertStatus(403);
        $this->actingAs($cs)->get($ktpUrl)->assertStatus(200);

        $this->postJson('/api/auth/logout');
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->getJson($ktpUrl)->assertStatus(401);

        // 5. UU PDP Maintenance Command
        $this->artisan('lofound:maintenance')->assertExitCode(0);
    }
}
