<?php

namespace App\Console\Commands;

use App\Models\KategoriBarang;
use App\Models\LaporanBarangHilang;
use App\Models\Stasiun;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class TestLoFoundCrud extends Command
{
    protected $signature = 'lofound:test-crud';
    protected $description = 'Test all Authentication and Report CRUD endpoints';

    private int $passed = 0;
    private int $failed = 0;

    public function handle(): int
    {
        $this->info("=== TESTING AUTHENTICATION & REPORT CRUD ===");

        $this->testHomeEndpoints();
        $this->testAuthentication();
        $this->testReportCrud();
        $this->testStaffEndpoints();

        $this->newLine();
        $this->info("=== RESULTS ===");
        $this->line("Passed: <info>{$this->passed}</info>");
        if ($this->failed > 0) {
            $this->line("Failed: <error>{$this->failed}</error>");
            return 1;
        }
        $this->line("All CRUD tests passed successfully!");
        return 0;
    }

    private function assert(string $label, bool $condition, string $detail = ''): void
    {
        if ($condition) {
            $this->line("  [PASS] {$label}");
            $this->passed++;
        } else {
            $this->line("  [FAIL] <error>{$label}</error> - {$detail}");
            $this->failed++;
        }
    }

    private function callEndpoint(string $method, string $uri, array $data = [], ?User $user = null): \Illuminate\Http\JsonResponse|\Symfony\Component\HttpFoundation\Response
    {
        if ($user) {
            Auth::login($user);
        } else {
            Auth::logout();
        }

        $request = Request::create($uri, $method, [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT'  => 'application/json',
        ], json_encode($data));

        if ($user) {
            $request->setUserResolver(fn () => $user);
        }

        return app()->handle($request);
    }

    private function testHomeEndpoints(): void
    {
        $this->info("\n--- 1. Testing Home Endpoints ---");

        $res = $this->callEndpoint('GET', '/api/home-stats');
        $this->assert(
            "GET /api/home-stats returns 200",
            $res->getStatusCode() === 200,
            "Got status: " . $res->getStatusCode() . " Content: " . $res->getContent()
        );

        $json = json_decode($res->getContent(), true);
        $this->assert(
            "home-stats contains total, returned, ratio, in_progress",
            isset($json['total'], $json['returned'], $json['ratio'], $json['in_progress'])
        );

        $resFeed = $this->callEndpoint('GET', '/api/home-feed');
        $this->assert(
            "GET /api/home-feed returns 200",
            $resFeed->getStatusCode() === 200
        );

        $feedJson = json_decode($resFeed->getContent(), true);
        $this->assert(
            "home-feed returns an array",
            is_array($feedJson)
        );
    }

    private function testAuthentication(): void
    {
        $this->info("\n--- 2. Testing Authentication Endpoints ---");

        // 1. Invalid credentials
        $badRes = $this->callEndpoint('POST', '/api/auth/login', [
            'contact'  => 'ramdhan@mail.com',
            'password' => 'wrongpassword',
        ]);
        $this->assert(
            "POST /api/auth/login with wrong password returns 422",
            $badRes->getStatusCode() === 422,
            "Got: " . $badRes->getStatusCode() . " Content: " . $badRes->getContent()
        );

        // 2. Valid credentials
        $loginRes = $this->callEndpoint('POST', '/api/auth/login', [
            'contact'  => 'ramdhan@mail.com',
            'password' => 'password',
        ]);
        $this->assert(
            "POST /api/auth/login with valid credentials returns 200",
            $loginRes->getStatusCode() === 200,
            "Got: " . $loginRes->getStatusCode() . " Content: " . $loginRes->getContent()
        );
        $loginData = json_decode($loginRes->getContent(), true);
        $this->assert(
            "Login response has user profile",
            isset($loginData['user']['name'], $loginData['user']['contact']) && $loginData['user']['name'] === 'M.'
        );

        // 3. Register new user
        $testEmail = 'user_' . time() . '@lofound.test';
        $regRes = $this->callEndpoint('POST', '/api/auth/register', [
            'name'     => 'Budi Penumpang',
            'contact'  => $testEmail,
            'password' => 'secret1234',
        ]);
        $this->assert(
            "POST /api/auth/register returns 201",
            $regRes->getStatusCode() === 201,
            "Got: " . $regRes->getStatusCode() . " Content: " . $regRes->getContent()
        );
        $regUser = User::where('email', $testEmail)->first();
        $this->assert(
            "Registered user exists with role penumpang",
            $regUser !== null && $regUser->role === 'penumpang'
        );

        // 4. Duplicate register fails
        $dupRegRes = $this->callEndpoint('POST', '/api/auth/register', [
            'name'     => 'Budi Penumpang',
            'contact'  => $testEmail,
            'password' => 'secret1234',
        ]);
        $this->assert(
            "Duplicate register returns 422",
            $dupRegRes->getStatusCode() === 422
        );

        // 5. Auth User check
        $userRes = $this->callEndpoint('GET', '/api/auth/user', [], $regUser);
        $userData = json_decode($userRes->getContent(), true);
        $this->assert(
            "GET /api/auth/user returns logged-in user",
            $userRes->getStatusCode() === 200 && ($userData['user']['contact'] ?? '') === $testEmail
        );
    }

    private function testReportCrud(): void
    {
        $this->info("\n--- 3. Testing Report CRUD Endpoints ---");

        $user = User::where('email', 'ramdhan@mail.com')->firstOrFail();

        // 1. List reports
        $listRes = $this->callEndpoint('GET', '/api/reports', [], $user);
        $this->assert(
            "GET /api/reports returns 200",
            $listRes->getStatusCode() === 200,
            "Got: " . $listRes->getStatusCode()
        );
        $reports = json_decode($listRes->getContent(), true);
        $this->assert(
            "GET /api/reports returns array of reports with frontend contract",
            is_array($reports) && count($reports) > 0 && isset($reports[0]['id'], $reports[0]['items'], $reports[0]['status'], $reports[0]['from'], $reports[0]['to'])
        );

        // 2. Check duplicate report (matching existing report #LPR-2026-042)
        $dupCheckRes = $this->callEndpoint('POST', '/api/reports/check-duplicate', [
            'from'     => 'Bogor',
            'to'       => 'Manggarai',
            'date'     => '2026-11-02',
            'time'     => '10:15',
            'category' => 'Elektronik',
        ], $user);
        $this->assert(
            "POST /api/reports/check-duplicate returns 200",
            $dupCheckRes->getStatusCode() === 200
        );
        $dupJson = json_decode($dupCheckRes->getContent(), true);
        $this->assert(
            "Duplicate check identifies #LPR-2026-042",
            isset($dupJson['duplicate']) && $dupJson['duplicate']['id'] === 'LPR-2026-042'
        );

        // 3. Create new report
        $createRes = $this->callEndpoint('POST', '/api/reports', [
            'items' => [
                ['name' => 'Kacamata Rayban Hitam', 'category' => 'Non Elektronik', 'color' => 'Hitam'],
                ['name' => 'Kotak Kacamata Kulit', 'category' => 'Non Elektronik', 'color' => 'Coklat'],
            ],
            'from'     => 'Depok',
            'to'       => 'Manggarai',
            'date'     => '2026-11-18',
            'time'     => '08:30',
            'position' => 'Gerbong 3 - Rak Atas',
            'secret'   => 'Ada grafir inisial RM di gagang kanan bagian dalam',
            'notify'   => true,
        ], $user);
        $this->assert(
            "POST /api/reports creates report and returns 201",
            $createRes->getStatusCode() === 201,
            "Got: " . $createRes->getStatusCode() . " Content: " . $createRes->getContent()
        );

        $newReportData = json_decode($createRes->getContent(), true)['report'] ?? [];
        $newKode = $newReportData['id'] ?? '';
        $this->assert(
            "New report code generated with sub-items",
            !empty($newKode) && count($newReportData['items'] ?? []) === 2
        );

        // 4. Update report (PATCH)
        $patchRes = $this->callEndpoint('PATCH', "/api/reports/{$newKode}", [
            'name'     => 'Kacamata Rayban Aviator Hitam',
            'color'    => 'Hitam',
            'position' => 'Gerbong 4 - Kursi Prioritas',
            'secret'   => 'Ada grafir inisial RM di gagang kanan bagian dalam dan lap pembersih abu-abu',
        ], $user);
        $this->assert(
            "PATCH /api/reports/{kode} returns 200",
            $patchRes->getStatusCode() === 200,
            "Got: " . $patchRes->getStatusCode() . " Content: " . $patchRes->getContent()
        );
        $patchedData = json_decode($patchRes->getContent(), true)['report'] ?? [];
        $this->assert(
            "Updated report contains modified values and logged history",
            ($patchedData['position'] ?? '') === 'Gerbong 4 - Kursi Prioritas' &&
            count($patchedData['history'] ?? []) >= 2
        );

        // 5. Cancel report
        $cancelRes = $this->callEndpoint('POST', '/api/reports/cancel', [
            'ids'    => [$newKode],
            'reason' => 'Barang sudah ditemukan sendiri di tas ransel',
        ], $user);
        $this->assert(
            "POST /api/reports/cancel cancels the report",
            $cancelRes->getStatusCode() === 200
        );

        $freshReport = LaporanBarangHilang::where('kode', $newKode)->first();
        $this->assert(
            "Report status is now 'dibatalkan'",
            $freshReport && $freshReport->status === 'dibatalkan'
        );

        // 6. Reactivate cancelled report
        $reactivateRes = $this->callEndpoint('POST', "/api/reports/{$newKode}/reactivate", [], $user);
        $this->assert(
            "POST /api/reports/{kode}/reactivate returns 200",
            $reactivateRes->getStatusCode() === 200
        );
        $freshReport->refresh();
        $this->assert(
            "Report status is restored to 'pencarian'",
            $freshReport->status === 'pencarian'
        );

        // 7. Merge 2 reports with same route and date
        // Create second report for same route and date
        $create2Res = $this->callEndpoint('POST', '/api/reports', [
            'items' => [
                ['name' => 'Tumbler Corkcicle Putih', 'category' => 'Non Elektronik', 'color' => 'Putih'],
            ],
            'from'     => 'Depok',
            'to'       => 'Manggarai',
            'date'     => '2026-11-18',
            'time'     => '08:35',
            'position' => 'Gerbong 4',
            'secret'   => 'Stiker kucing di bagian bawah botol',
            'notify'   => true,
        ], $user);
        $report2Data = json_decode($create2Res->getContent(), true)['report'] ?? [];
        $kode2 = $report2Data['id'] ?? '';

        $mergeRes = $this->callEndpoint('POST', '/api/reports/merge', [
            'ids' => [$newKode, $kode2],
        ], $user);
        $this->assert(
            "POST /api/reports/merge returns 200",
            $mergeRes->getStatusCode() === 200,
            "Got: " . $mergeRes->getStatusCode() . " Content: " . $mergeRes->getContent()
        );
        $mergedReport = json_decode($mergeRes->getContent(), true)['report'] ?? [];
        $this->assert(
            "Merged report has all combined items (3 items)",
            count($mergedReport['items'] ?? []) === 3
        );

        // 8. Candidates for #LPR-2026-042
        $candRes = $this->callEndpoint('GET', '/api/reports/LPR-2026-042/candidates', [], $user);
        $this->assert(
            "GET /api/reports/LPR-2026-042/candidates returns 200",
            $candRes->getStatusCode() === 200
        );
        $cands = json_decode($candRes->getContent(), true);
        $this->assert(
            "Found 3 candidate items for LPR-2026-042",
            is_array($cands) && count($cands) === 3
        );

        // 9. Submit Claim for LPR-2026-042
        $claimRes = $this->callEndpoint('POST', '/api/reports/LPR-2026-042/claim', [
            'candidates' => ['FND-0412'],
            'answers'    => [
                'FND-0412' => 'MacBook Air M2 Silver, stiker NASA di pojok kanan bawah, serial ...7QX2',
            ],
            'nik'        => '3201123456780001',
        ], $user);
        $this->assert(
            "POST /api/reports/LPR-2026-042/claim returns 200 and sets status to ditinjau",
            $claimRes->getStatusCode() === 200
        );
        $claimedReport = json_decode($claimRes->getContent(), true)['report'] ?? [];
        $this->assert(
            "Report status is now 'ditinjau'",
            ($claimedReport['status'] ?? '') === 'ditinjau'
        );

        // 10. BAST flow: simulate CS approval then confirm pickup
        $lap042 = LaporanBarangHilang::where('kode', 'LPR-2026-042')->first();
        $lap042->update(['status' => 'bast']);

        $bastRes = $this->callEndpoint('POST', '/api/reports/LPR-2026-042/bast', [
            'method' => 'stasiun',
        ], $user);
        $this->assert(
            "POST /api/reports/LPR-2026-042/bast (stasiun) returns 200",
            $bastRes->getStatusCode() === 200,
            "Got: " . $bastRes->getStatusCode() . " Content: " . $bastRes->getContent()
        );
        $bastJson = json_decode($bastRes->getContent(), true);
        $this->assert(
            "BAST generates code and QR",
            !empty($bastJson['bast']) && !empty($bastJson['qr'])
        );
    }

    private function testStaffEndpoints(): void
    {
        $this->newLine();
        $this->info("--- Testing Staff RBAC & APIs ---");

        // 1. Staff login
        $staffLoginRes = $this->callEndpoint('POST', '/api/staff/auth/login', [
            'email'    => 'rina.k@kci.id',
            'password' => 'lofound2026',
        ]);
        $this->assert(
            "POST /api/staff/auth/login returns 200",
            $staffLoginRes->getStatusCode() === 200,
            "Got: " . $staffLoginRes->getStatusCode() . " Content: " . $staffLoginRes->getContent()
        );
        $staffJson = json_decode($staffLoginRes->getContent(), true);
        $this->assert(
            "Staff user has role 'cs'",
            ($staffJson['user']['role'] ?? '') === 'cs'
        );

        $csUser = User::where('email', 'rina.k@kci.id')->first();

        // 2. CS Dashboard
        $dashRes = $this->callEndpoint('GET', '/api/staff/cs/dashboard', [], $csUser);
        $this->assert(
            "GET /api/staff/cs/dashboard returns 200",
            $dashRes->getStatusCode() === 200
        );
        $dashJson = json_decode($dashRes->getContent(), true);
        $this->assert(
            "CS Dashboard returns inventory, claims, counts",
            isset($dashJson['inventory']) && isset($dashJson['claims']) && isset($dashJson['counts'])
        );

        // 3. CS Input Found Item + Auto-matching
        $foundRes = $this->callEndpoint('POST', '/api/staff/cs/found-items', [
            'cat'     => 'Elektronik',
            'name'    => 'iPad Pro 11 inch Space Grey',
            'color'   => 'Hitam',
            'station' => 'Jakarta Kota',
            'detail'  => 'Ada case magnetik biru navy',
            'serial'  => 'DMPX' . rand(10000, 99999),
            'locker'  => 'Loker C-01',
            'notes'   => 'Ditemukan di bangku peron 4',
        ], $csUser);
        $this->assert(
            "POST /api/staff/cs/found-items creates item & auto-matches",
            $foundRes->getStatusCode() === 200,
            "Got: " . $foundRes->getStatusCode() . " Content: " . $foundRes->getContent()
        );

        // 4. CS Verify Claim (Approve)
        $klaim = \App\Models\KlaimVerifikasi::first();
        if ($klaim) {
            $verifyRes = $this->callEndpoint('POST', "/api/staff/cs/claims/{$klaim->id}/verify", [
                'action' => 'approve',
                'note'   => 'Verifikasi nomor seri dan stiker cocok sempurna',
            ], $csUser);
            $this->assert(
                "POST /api/staff/cs/claims/{id}/verify (approve) returns 200 & BAST",
                $verifyRes->getStatusCode() === 200 && !empty(json_decode($verifyRes->getContent(), true)['bast'])
            );
        }

        // 5. CS Handover via QR Code
        $bast = \App\Models\BastPengambilan::where('metode_ambil', 'stasiun')->first();
        if ($bast) {
            $handoverRes = $this->callEndpoint('POST', '/api/staff/cs/bast/handover', [
                'qr_code' => $bast->kode_qr,
                'confirm' => true,
            ], $csUser);
            $this->assert(
                "POST /api/staff/cs/bast/handover confirms pickup",
                $handoverRes->getStatusCode() === 200 && (json_decode($handoverRes->getContent(), true)['result'] ?? '') === 'done'
            );
        }

        // 6. Logistics Inventory & Ship Order
        $logistikUser = User::where('role', 'logistik')->first();
        $logInvRes = $this->callEndpoint('GET', '/api/staff/logistics/inventory', [], $logistikUser);
        $this->assert(
            "GET /api/staff/logistics/inventory returns shipments queue",
            $logInvRes->getStatusCode() === 200
        );

        $expShipment = \App\Models\BastPengambilan::where('metode_ambil', 'ekspedisi')->first();
        if ($expShipment) {
            $shipRes = $this->callEndpoint('POST', "/api/staff/logistics/shipments/{$expShipment->id}/ship", [
                'awb'    => 'KALOG-TEST998877',
                'action' => 'ship',
            ], $logistikUser);
            $this->assert(
                "POST /api/staff/logistics/shipments/{id}/ship marks status as Dikirim",
                $shipRes->getStatusCode() === 200 && (json_decode($shipRes->getContent(), true)['status'] ?? '') === 'Dikirim'
            );
        }

        // 7. Admin CRUD & Audit Logs
        $adminUser = User::where('role', 'admin')->first();
        $adminUsersRes = $this->callEndpoint('GET', '/api/staff/admin/users', [], $adminUser);
        $this->assert(
            "GET /api/staff/admin/users returns staff list",
            $adminUsersRes->getStatusCode() === 200
        );

        $adminAuditRes = $this->callEndpoint('GET', '/api/staff/admin/audit-logs', [], $adminUser);
        $this->assert(
            "GET /api/staff/admin/audit-logs returns audit log records",
            $adminAuditRes->getStatusCode() === 200 && count(json_decode($adminAuditRes->getContent(), true)) > 0
        );

        // 8. Manager Analytics KPIs
        $mgrUser = User::where('role', 'kepala_stasiun')->first();
        $mgrStatsRes = $this->callEndpoint('GET', '/api/staff/manager/stats', [], $mgrUser);
        $this->assert(
            "GET /api/staff/manager/stats returns KPIs and trend series",
            $mgrStatsRes->getStatusCode() === 200 && isset(json_decode($mgrStatsRes->getContent(), true)['kpis'])
        );
    }
}
