<?php

namespace Tests\Feature;

use App\Models\BarangTemuan;
use App\Models\BastPengambilan;
use App\Models\DetailBarangHilang;
use App\Models\KategoriBarang;
use App\Models\KlaimVerifikasi;
use App\Models\LaporanBarangHilang;
use App\Models\Stasiun;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MidtransShippingTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        if (Stasiun::count() === 0) {
            $this->seed(\Database\Seeders\DatabaseSeeder::class);
        }
    }

    private function seedApprovedClaimScenario(): array
    {
        $stasiunDari = Stasiun::firstOrCreate(
            ['kode' => 'BOO'],
            ['nama' => 'Bogor', 'lin' => 'Lin Bogor', 'active' => true]
        );
        $stasiunKe = Stasiun::firstOrCreate(
            ['kode' => 'JAKK'],
            ['nama' => 'Jakarta Kota', 'lin' => 'Lin Bogor', 'active' => true]
        );
        $kategori = KategoriBarang::firstOrCreate(
            ['nama' => 'Elektronik'],
            ['ikon' => 'laptop', 'retention_days' => 30, 'shippable' => true, 'active' => true]
        );

        $passenger = User::firstOrCreate(
            ['email' => 'ramdhan@mail.com'],
            [
                'name'     => 'M. Ramdhan Maulana',
                'phone'    => '081234567890',
                'password' => bcrypt('password'),
                'role'     => 'penumpang',
            ]
        );

        $cs = User::firstOrCreate(
            ['email' => 'rina.k@kci.id'],
            [
                'name'       => 'Rina Kurniasih',
                'password'   => bcrypt('password'),
                'role'       => 'cs',
                'stasiun_id' => $stasiunKe->id,
            ]
        );

        $laporan = LaporanBarangHilang::create([
            'kode'             => 'LPR-2026-901',
            'user_id'          => $passenger->id,
            'stasiun_dari_id'  => $stasiunDari->id,
            'stasiun_ke_id'    => $stasiunKe->id,
            'tanggal_kejadian' => now()->toDateString(),
            'waktu_kejadian'   => '10:15',
            'posisi_terakhir'  => 'Gerbong 4',
            'ciri_rahasia'     => 'Stiker biru di pojok kiri',
            'status'           => 'bast',
        ]);

        DetailBarangHilang::create([
            'laporan_id'  => $laporan->id,
            'sub_kode'    => 'A',
            'kategori_id' => $kategori->id,
            'nama_barang' => 'MacBook Air M2 Silver',
            'warna'       => 'Silver',
        ]);

        $temuan = BarangTemuan::create([
            'kode'              => 'FND-2026-901',
            'petugas_id'        => $cs->id,
            'stasiun_temuan_id' => $stasiunKe->id,
            'kategori_id'       => $kategori->id,
            'nama_barang'       => 'Laptop silver',
            'warna'             => 'Silver',
            'tanggal_temuan'    => now()->toDateString(),
            'waktu_temuan'      => '12:30',
            'status_simpan'     => 'Dalam Klaim',
        ]);

        $klaim = KlaimVerifikasi::create([
            'kode'              => 'KLM-2026-901',
            'laporan_id'        => $laporan->id,
            'barang_temuan_id'  => $temuan->id,
            'jawaban_rahasia'   => 'Stiker biru di pojok kiri',
            'nik'               => '3201710409980003',
            'status_verifikasi' => 'disetujui',
            'verified_by'       => $cs->id,
        ]);

        return [$passenger, $laporan, $klaim];
    }

    public function test_shipping_checkout_creates_sandbox_snap_transaction_with_unique_order_id_and_item_details(): void
    {
        config()->set('services.midtrans.server_key', 'SB-Mid-server-TestKey123');
        config()->set('services.midtrans.client_key', 'SB-Mid-client-TestKey123');
        config()->set('services.midtrans.is_production', false);

        [$passenger, $laporan] = $this->seedApprovedClaimScenario();

        Http::fake([
            'https://app.sandbox.midtrans.com/snap/v1/transactions' => Http::response([
                'token'        => 'snap-tok-sandbox-001',
                'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-tok-sandbox-001',
            ], 201),
        ]);

        $res = $this->actingAs($passenger)->postJson("/api/reports/{$laporan->kode}/bast", [
            'method'     => 'ekspedisi',
            'courier'    => 'KAI Logistik Express',
            'address'    => 'Jl. Merdeka No. 24',
            'city'       => 'Bogor Tengah',
            'zip'        => '16124',
            'name'       => 'M. Ramdhan Maulana',
            'wa'         => '081234567890',
            'insure'     => true,
            'pay_method' => 'qris',
        ]);

        $res->assertOk()
            ->assertJsonPath('snap_token', 'snap-tok-sandbox-001')
            ->assertJsonPath('midtrans_mode', 'sandbox')
            ->assertJsonPath('report.status', 'bast')
            ->assertJsonPath('report.paymentStatus', 'pending');

        $orderId = $res->json('order_id');
        $this->assertStringStartsWith($res->json('bast') . '-', $orderId);

        $bast = BastPengambilan::where('midtrans_order_id', $orderId)->firstOrFail();
        $this->assertSame($orderId, $bast->midtrans_order_id);
        $this->assertSame('pending', $bast->status_bayar);
        $this->assertSame(25500, $bast->ongkir);

        Http::assertSent(function ($request) use ($orderId, $laporan) {
            $data = $request->data();
            $itemsSum = collect($data['item_details'] ?? [])->sum('price');

            return $request->url() === 'https://app.sandbox.midtrans.com/snap/v1/transactions'
                && ($data['transaction_details']['order_id'] ?? null) === $orderId
                && ($data['transaction_details']['gross_amount'] ?? null) === 25500
                && str_contains((string) ($data['callbacks']['finish'] ?? ''), "/payment/return/{$laporan->kode}")
                && str_contains((string) ($data['callbacks']['unfinish'] ?? ''), "/payment/return/{$laporan->kode}")
                && str_contains((string) ($data['callbacks']['error'] ?? ''), "/payment/return/{$laporan->kode}")
                && $itemsSum === 25500
                && count($data['item_details']) === 3;
        });
    }

    public function test_retrying_shipping_checkout_generates_new_unique_order_id(): void
    {
        config()->set('services.midtrans.server_key', 'SB-Mid-server-TestKey123');
        config()->set('services.midtrans.is_production', false);

        [$passenger, $laporan] = $this->seedApprovedClaimScenario();

        Http::fake([
            'https://app.sandbox.midtrans.com/snap/v1/transactions' => Http::sequence()
                ->push(['token' => 'tok-1', 'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v2/vtweb/tok-1'], 201)
                ->push(['token' => 'tok-2', 'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v2/vtweb/tok-2'], 201),
        ]);

        $first = $this->actingAs($passenger)->postJson("/api/reports/{$laporan->kode}/bast", [
            'method'  => 'ekspedisi',
            'courier' => 'KAI Logistik Express',
            'insure'  => true,
        ])->assertOk();

        $second = $this->actingAs($passenger)->postJson("/api/reports/{$laporan->kode}/bast", [
            'method'  => 'ekspedisi',
            'courier' => 'JNE Reguler',
            'insure'  => false,
        ])->assertOk();

        $this->assertNotSame($first->json('order_id'), $second->json('order_id'));
        $this->assertSame('tok-2', $second->json('snap_token'));

        Http::assertSent(function ($request) {
            return $request->url() === 'https://app.sandbox.midtrans.com/snap/v1/transactions'
                && ! array_key_exists('enabled_payments', $request->data());
        });
    }

    public function test_sync_payment_endpoint_updates_bast_and_report_when_midtrans_reports_settlement(): void
    {
        config()->set('services.midtrans.server_key', 'SB-Mid-server-TestKey123');
        config()->set('services.midtrans.is_production', false);

        [$passenger, $laporan, $klaim] = $this->seedApprovedClaimScenario();

        $bast = BastPengambilan::create([
            'kode'              => 'BAST-2026-901',
            'midtrans_order_id' => 'BAST-2026-901-1732680000-ab12',
            'klaim_id'          => $klaim->id,
            'metode_ambil'      => 'ekspedisi',
            'alamat_kirim'      => 'Jl. Merdeka 24',
            'kurir'             => 'KAI Logistik Express',
            'ongkir'            => 25500,
            'status_bayar'      => 'pending',
            'snap_token'        => 'snap-tok-123',
        ]);

        Http::fake([
            "https://api.sandbox.midtrans.com/v2/{$bast->midtrans_order_id}/status" => Http::response([
                'status_code'        => '200',
                'transaction_status' => 'settlement',
                'fraud_status'       => 'accept',
                'payment_type'       => 'qris',
                'gross_amount'       => '25500.00',
            ], 200),
        ]);

        $res = $this->actingAs($passenger)->postJson("/api/reports/{$laporan->kode}/bast/sync-payment");

        $res->assertOk()
            ->assertJsonPath('payment_status', 'lunas')
            ->assertJsonPath('transaction_status', 'settlement')
            ->assertJsonPath('payment_type', 'qris')
            ->assertJsonPath('report.status', 'dikirim')
            ->assertJsonPath('report.paymentStatus', 'lunas');

        $this->assertSame('lunas', $bast->fresh()->status_bayar);
        $this->assertSame('qris', $bast->fresh()->payment_type);
        $this->assertSame('dikirim', $laporan->fresh()->status);
    }

    public function test_payment_webhook_verifies_signature_by_midtrans_order_id_and_handles_expire(): void
    {
        config()->set('services.midtrans.server_key', 'SB-Mid-server-TestKey123');

        [, $laporan, $klaim] = $this->seedApprovedClaimScenario();

        $bast = BastPengambilan::create([
            'kode'              => 'BAST-2026-902',
            'midtrans_order_id' => 'BAST-2026-902-1732680001-cd34',
            'klaim_id'          => $klaim->id,
            'metode_ambil'      => 'ekspedisi',
            'kurir'             => 'JNE Reguler',
            'ongkir'            => 18500,
            'status_bayar'      => 'pending',
        ]);

        // Bad signature -> 403
        $this->postJson('/api/webhooks/payment', [
            'order_id'           => $bast->midtrans_order_id,
            'status_code'        => '200',
            'gross_amount'       => '18500.00',
            'transaction_status' => 'settlement',
            'signature_key'      => 'invalid-signature',
        ])->assertStatus(403);

        // Expire webhook with valid signature -> gagal
        $expireSig = hash('sha512', $bast->midtrans_order_id . '202' . '18500.00' . 'SB-Mid-server-TestKey123');
        $this->postJson('/api/webhooks/payment', [
            'order_id'           => $bast->midtrans_order_id,
            'status_code'        => '202',
            'gross_amount'       => '18500.00',
            'transaction_status' => 'expire',
            'payment_type'       => 'bank_transfer',
            'signature_key'      => $expireSig,
        ])->assertOk();

        $this->assertSame('gagal', $bast->fresh()->status_bayar);
        $this->assertSame('bast', $laporan->fresh()->status);

        // Endpoint health check (GET) and Midtrans Dashboard Test Notification (valid & dummy signature)
        $this->getJson('/api/webhooks/payment')->assertOk()->assertJsonPath('ok', true);
        $testOrderId = 'payment_notif_test_12345';
        $testSig = hash('sha512', $testOrderId . '200' . '10000.00' . 'SB-Mid-server-TestKey123');
        $this->postJson('/api/webhooks/payment', [
            'order_id'           => $testOrderId,
            'status_code'        => '200',
            'gross_amount'       => '10000.00',
            'transaction_status' => 'settlement',
            'signature_key'      => $testSig,
        ])->assertOk()
            ->assertJsonPath('test', true)
            ->assertJsonPath('signature_valid', true);

        $this->postJson('/api/webhooks/payment', [
            'order_id'           => $testOrderId,
            'status_code'        => '200',
            'gross_amount'       => '105000.00',
            'transaction_status' => 'settlement',
            'signature_key'      => 'dummy-dashboard-test-signature',
        ])->assertOk()
            ->assertJsonPath('test', true)
            ->assertJsonPath('signature_valid', false);
    }

    public function test_shipping_checkout_returns_502_when_midtrans_api_rejects_request(): void
    {
        config()->set('services.midtrans.server_key', 'SB-Mid-server-InvalidKey');
        config()->set('services.midtrans.is_production', false);

        [$passenger, $laporan] = $this->seedApprovedClaimScenario();

        Http::fake([
            'https://app.sandbox.midtrans.com/snap/v1/transactions' => Http::response([
                'error_messages' => ['Access denied due to unauthorized transaction'],
            ], 401),
        ]);

        $res = $this->actingAs($passenger)->postJson("/api/reports/{$laporan->kode}/bast", [
            'method'  => 'ekspedisi',
            'courier' => 'Pos Indonesia',
            'insure'  => false,
        ]);

        $res->assertStatus(502)
            ->assertJsonPath('gateway_error', 'Access denied due to unauthorized transaction');

        $this->assertDatabaseMissing('bast_pengambilan', ['kurir' => 'Pos Indonesia', 'ongkir' => 16500, 'status_bayar' => 'pending']);
        $this->assertSame('bast', $laporan->fresh()->status);
    }

    public function test_shipping_checkout_falls_back_to_simulation_when_midtrans_keys_are_empty(): void
    {
        config()->set('services.midtrans.server_key', null);
        config()->set('services.midtrans.client_key', null);

        [$passenger, $laporan] = $this->seedApprovedClaimScenario();

        $res = $this->actingAs($passenger)->postJson("/api/reports/{$laporan->kode}/bast", [
            'method'  => 'ekspedisi',
            'courier' => 'KAI Logistik Express',
            'insure'  => true,
        ]);

        $res->assertOk()
            ->assertJsonPath('midtrans_mode', 'simulation')
            ->assertJsonPath('snap_token', null)
            ->assertJsonPath('payment_url', null)
            ->assertJsonPath('report.status', 'dikirim')
            ->assertJsonPath('report.paymentStatus', 'lunas');
    }

    public function test_cancel_payment_cancels_pending_transaction_and_allows_recheckout(): void
    {
        config()->set('services.midtrans.server_key', 'SB-Mid-server-TestKey123');
        config()->set('services.midtrans.is_production', false);

        [$passenger, $laporan, $klaim] = $this->seedApprovedClaimScenario();

        $bast = BastPengambilan::create([
            'kode'              => 'BAST-2026-903',
            'midtrans_order_id' => 'BAST-2026-903-1732680099-ef56',
            'klaim_id'          => $klaim->id,
            'metode_ambil'      => 'ekspedisi',
            'alamat_kirim'      => 'Jl. Merdeka 24',
            'kurir'             => 'KAI Logistik Express',
            'ongkir'            => 25500,
            'status_bayar'      => 'pending',
            'snap_token'        => 'snap-tok-cancel-001',
            'payment_url'       => 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-tok-cancel-001',
        ]);

        Http::fake([
            "https://api.sandbox.midtrans.com/v2/{$bast->midtrans_order_id}/cancel" => Http::response([
                'status_code'        => '200',
                'transaction_status' => 'cancel',
            ], 200),
        ]);

        $res = $this->actingAs($passenger)->postJson("/api/reports/{$laporan->kode}/bast/cancel-payment");

        $res->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('report.paymentStatus', 'gagal')
            ->assertJsonPath('report.snapToken', null)
            ->assertJsonPath('report.paymentUrl', null);

        $freshBast = $bast->fresh();
        $this->assertSame('gagal', $freshBast->status_bayar);
        $this->assertNull($freshBast->snap_token);
        $this->assertNull($freshBast->payment_url);

        Http::assertSent(fn ($request) => $request->url() === "https://api.sandbox.midtrans.com/v2/{$bast->midtrans_order_id}/cancel");

        // Paid BAST cannot be cancelled
        $freshBast->update(['status_bayar' => 'lunas']);
        $this->actingAs($passenger)
            ->postJson("/api/reports/{$laporan->kode}/bast/cancel-payment")
            ->assertStatus(422);
    }

    public function test_signed_payment_return_route_restores_passenger_session_and_rejects_tampered_signature(): void
    {
        [$passenger, $laporan] = $this->seedApprovedClaimScenario();

        $returnUrl = \App\Services\PaymentGatewayService::buildReturnUrl('http://localhost', $laporan->kode, $passenger->id);
        $parsedQuery = [];
        parse_str((string) parse_url($returnUrl, PHP_URL_QUERY), $parsedQuery);

        // Tampered signature must NOT inject passenger payload or log user in
        $tamperedRes = $this->get("/payment/return/{$laporan->kode}?uid={$passenger->id}&exp={$parsedQuery['exp']}&sig=tampered");
        $tamperedRes->assertOk()
            ->assertDontSee('window.__LOFOUND_PAYMENT_RETURN__', false);
        $this->assertGuest();

        // Valid signed return URL restores passenger payload even when gateway appends status params
        $validRes = $this->get($returnUrl . '&order_id=BAST-123&status_code=200&transaction_status=settlement');
        $validRes->assertOk()
            ->assertSee('window.__LOFOUND_PAYMENT_RETURN__', false)
            ->assertSee($laporan->kode, false);

        $this->assertAuthenticatedAs($passenger);
    }
}
