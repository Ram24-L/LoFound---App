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

class BiteshipShippingTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        if (Stasiun::count() === 0) {
            $this->seed(\Database\Seeders\DatabaseSeeder::class);
        }
    }

    private function seedApprovedScenario(): array
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

        $logistik = User::firstOrCreate(
            ['email' => 'agus.p@kci.id'],
            [
                'name'       => 'Agus Pratama',
                'password'   => bcrypt('password'),
                'role'       => 'logistik',
                'stasiun_id' => $stasiunKe->id,
            ]
        );

        $laporan = LaporanBarangHilang::create([
            'kode'             => 'LPR-2026-951',
            'user_id'          => $passenger->id,
            'stasiun_dari_id'  => $stasiunDari->id,
            'stasiun_ke_id'    => $stasiunKe->id,
            'tanggal_kejadian' => now()->toDateString(),
            'waktu_kejadian'   => '10:15',
            'posisi_terakhir'  => 'Gerbong 4',
            'ciri_rahasia'     => 'Stiker hijau kecil',
            'status'           => 'bast',
        ]);

        DetailBarangHilang::create([
            'laporan_id'  => $laporan->id,
            'sub_kode'    => 'A',
            'kategori_id' => $kategori->id,
            'nama_barang' => 'Headphone Sony',
            'warna'       => 'Hitam',
        ]);

        $temuan = BarangTemuan::create([
            'kode'              => 'FND-2026-951',
            'petugas_id'        => $logistik->id,
            'stasiun_temuan_id' => $stasiunKe->id,
            'kategori_id'       => $kategori->id,
            'nama_barang'       => 'Headphone Hitam',
            'warna'             => 'Hitam',
            'tanggal_temuan'    => now()->toDateString(),
            'waktu_temuan'      => '11:30',
            'status_simpan'     => 'Dalam Klaim',
        ]);

        $klaim = KlaimVerifikasi::create([
            'kode'              => 'KLM-2026-951',
            'laporan_id'        => $laporan->id,
            'barang_temuan_id'  => $temuan->id,
            'jawaban_rahasia'   => 'Stiker hijau kecil',
            'nik'               => '3201710409980003',
            'status_verifikasi' => 'disetujui',
            'verified_by'       => $logistik->id,
        ]);

        return [$passenger, $logistik, $laporan, $klaim, $temuan];
    }

    public function test_shipping_rates_returns_biteship_pricing_and_falls_back_when_key_empty(): void
    {
        [$passenger] = $this->seedApprovedScenario();

        config()->set('services.biteship.api_key', null);
        $fallback = $this->actingAs($passenger)->postJson('/api/shipping/rates', ['postal_code' => '16143']);
        $fallback->assertOk()
            ->assertJsonPath('configured', false)
            ->assertJsonPath('source', 'fallback');

        config()->set('services.biteship.api_key', 'biteship_test.TestKey123');
        Http::fake([
            'https://api.biteship.com/v1/rates/couriers' => Http::response([
                'success' => true,
                'pricing' => [
                    [
                        'courier_name'            => 'JNE',
                        'courier_code'            => 'jne',
                        'courier_service_name'    => 'REG',
                        'courier_service_code'    => 'reg',
                        'shipment_duration_range' => '1 - 2',
                        'shipment_duration_unit'  => 'days',
                        'price'                   => 12000,
                        'description'             => 'Layanan reguler JNE',
                    ],
                    [
                        'courier_name'            => 'Pos Indonesia',
                        'courier_code'            => 'pos',
                        'courier_service_name'    => 'Pos Reguler',
                        'courier_service_code'    => 'reg',
                        'shipment_duration_range' => '2 - 3',
                        'shipment_duration_unit'  => 'days',
                        'price'                   => 10000,
                        'description'             => 'Pos hemat',
                    ],
                ],
            ], 200),
        ]);

        $live = $this->actingAs($passenger)->postJson('/api/shipping/rates', ['postal_code' => '16143']);
        $live->assertOk()
            ->assertJsonPath('configured', true)
            ->assertJsonPath('source', 'biteship')
            ->assertJsonPath('couriers.0.company', 'pos')
            ->assertJsonPath('couriers.0.price', 10000)
            ->assertJsonPath('couriers.1.company', 'jne');
    }

    public function test_bast_verifies_courier_price_from_biteship_server_side(): void
    {
        config()->set('services.biteship.api_key', 'biteship_test.TestKey123');
        config()->set('services.midtrans.server_key', null);

        [$passenger, , $laporan] = $this->seedApprovedScenario();

        Http::fake([
            'https://api.biteship.com/v1/rates/couriers' => Http::response([
                'success' => true,
                'pricing' => [
                    [
                        'courier_name'            => 'JNE',
                        'courier_code'            => 'jne',
                        'courier_service_name'    => 'REG',
                        'courier_service_code'    => 'reg',
                        'shipment_duration_range' => '1 - 2',
                        'shipment_duration_unit'  => 'days',
                        'price'                   => 11500,
                    ],
                ],
            ], 200),
        ]);

        $res = $this->actingAs($passenger)->postJson("/api/reports/{$laporan->kode}/bast", [
            'method'          => 'ekspedisi',
            'courier'         => 'JNE REG',
            'courier_company' => 'jne',
            'courier_type'    => 'reg',
            'address'         => 'Jl. Pajajaran No. 12',
            'city'            => 'Bogor Tengah',
            'zip'             => '16143',
            'name'            => 'M. Ramdhan',
            'wa'              => '081234567890',
            'insure'          => true,
        ]);

        $res->assertOk()
            ->assertJsonPath('report.courierCompany', 'jne')
            ->assertJsonPath('report.courierType', 'reg')
            ->assertJsonPath('report.shippingAmount', 19000); // 11500 + 5000 + 2500
    }

    public function test_staff_logistics_generates_biteship_order_and_webhook_completes_delivery(): void
    {
        config()->set('services.biteship.api_key', 'biteship_test.TestKey123');
        config()->set('services.shipping.webhook_secret', null);

        [$passenger, $logistik, $laporan, $klaim, $temuan] = $this->seedApprovedScenario();

        $bast = BastPengambilan::create([
            'kode'                    => 'BAST-2026-951',
            'klaim_id'                => $klaim->id,
            'metode_ambil'            => 'ekspedisi',
            'alamat_kirim'            => 'Jl. Pajajaran No. 12, Bogor Tengah, 16143',
            'destination_postal_code' => '16143',
            'recipient_name'          => 'M. Ramdhan Maulana',
            'recipient_phone'         => '081234567890',
            'kurir'                   => 'JNE REG',
            'courier_company'         => 'jne',
            'courier_type'            => 'reg',
            'ongkir'                  => 19000,
            'status_bayar'            => 'lunas',
        ]);

        Http::fake([
            'https://api.biteship.com/v1/orders' => Http::response([
                'success' => true,
                'id'      => 'bshp-order-951',
                'status'  => 'confirmed',
                'courier' => [
                    'company'     => 'jne',
                    'type'        => 'reg',
                    'tracking_id' => 'bshp-track-951',
                    'waybill_id'  => 'JNEREG951888',
                ],
            ], 200),
            'https://api.biteship.com/v1/trackings/bshp-track-951' => Http::response([
                'success'    => true,
                'status'     => 'dropping_off',
                'waybill_id' => 'JNEREG951888',
                'history'    => [
                    ['status' => 'confirmed', 'note' => 'Order dikonfirmasi', 'updated_at' => '2026-11-27T08:00:00Z'],
                    ['status' => 'dropping_off', 'note' => 'Kurir menuju alamat tujuan', 'updated_at' => '2026-11-27T10:00:00Z'],
                ],
            ], 200),
        ]);

        $packRes = $this->actingAs($logistik)->postJson("/api/staff/logistics/shipments/{$bast->id}/ship", [
            'awb'    => '',
            'action' => 'pack',
        ]);

        $packRes->assertOk()
            ->assertJsonPath('awb', 'JNEREG951888')
            ->assertJsonPath('status', 'Dikemas');

        $freshBast = $bast->fresh();
        $this->assertSame('bshp-order-951', $freshBast->biteship_order_id);
        $this->assertSame('bshp-track-951', $freshBast->biteship_tracking_id);

        // Staff syncs live tracking
        $syncRes = $this->actingAs($logistik)->postJson("/api/staff/logistics/shipments/{$bast->id}/sync-tracking");
        $syncRes->assertOk()
            ->assertJsonPath('shipping_status', 'dropping_off');
        $this->assertSame('dikirim', $laporan->fresh()->status);

        // Passenger syncs live tracking
        $passengerSyncRes = $this->actingAs($passenger)->postJson("/api/reports/{$laporan->kode}/bast/sync-shipping");
        $passengerSyncRes->assertOk()
            ->assertJsonPath('shipping_status', 'dropping_off')
            ->assertJsonPath('awb', 'JNEREG951888')
            ->assertJsonCount(2, 'report.trackingHistory');

        // Biteship webhook marks delivered
        $webhookRes = $this->postJson('/api/webhooks/shipping', [
            'event' => 'order.status',
            'data'  => [
                'order_id'   => 'bshp-order-951',
                'status'     => 'delivered',
                'note'       => 'Paket diterima langsung oleh penerima',
                'updated_at' => '2026-11-27T14:20:00Z',
                'courier'    => ['waybill_id' => 'JNEREG951888', 'tracking_id' => 'bshp-track-951'],
            ],
        ]);
        $webhookRes->assertOk()->assertJsonPath('ok', true);

        $this->assertSame('selesai', $bast->fresh()->status_bayar);
        $this->assertSame('delivered', $bast->fresh()->shipping_status);
        $this->assertSame('selesai', $laporan->fresh()->status);
        $this->assertSame('Selesai', $temuan->fresh()->status_simpan);
    }

    public function test_biteship_real_flat_webhook_payloads_handle_probe_waybill_camelcase_status_and_delivered(): void
    {
        config()->set('services.shipping.webhook_secret', null);

        [, , $laporan, $klaim, $temuan] = $this->seedApprovedScenario();

        $bast = BastPengambilan::create([
            'kode'                    => 'BAST-2026-952',
            'klaim_id'                => $klaim->id,
            'metode_ambil'            => 'ekspedisi',
            'alamat_kirim'            => 'Jl. Sudirman No. 10, Bogor Tengah, 16143',
            'destination_postal_code' => '16143',
            'kurir'                   => 'JNE REG',
            'ongkir'                  => 19000,
            'status_bayar'            => 'dikemas',
            'biteship_order_id'       => '5dd6da88f43bd430ecd5aa2e',
        ]);

        // Dashboard verification GET + empty POST probe
        $this->getJson('/api/webhooks/shipping')->assertOk()->assertJsonPath('ok', true);
        $this->postJson('/api/webhooks/shipping', [])->assertOk()->assertJsonPath('ok', true);

        // Flat order.waybill_id event with courier_waybill_id & courier_tracking_id
        $this->postJson('/api/webhooks/shipping', [
            'event'               => 'order.waybill_id',
            'order_id'            => '5dd6da88f43bd430ecd5aa2e',
            'courier_waybill_id'  => 'SKS-998877',
            'courier_tracking_id' => 'XYZ-123-PQS',
            'courier_company'     => 'jne',
            'courier_type'        => 'reg',
        ])->assertOk();

        $freshAfterWaybill = $bast->fresh();
        $this->assertSame('SKS-998877', $freshAfterWaybill->nomor_resi);
        $this->assertSame('XYZ-123-PQS', $freshAfterWaybill->biteship_tracking_id);

        // Flat order.status event with camelCase "inTransit"
        $this->postJson('/api/webhooks/shipping', [
            'event'               => 'order.status',
            'order_id'            => '5dd6da88f43bd430ecd5aa2e',
            'status'              => 'inTransit',
            'courier_waybill_id'  => 'SKS-998877',
            'courier_tracking_id' => 'XYZ-123-PQS',
        ])->assertOk();

        $this->assertSame('in_transit', $bast->fresh()->shipping_status);
        $this->assertSame('dikirim', $bast->fresh()->status_bayar);
        $this->assertSame('dikirim', $laporan->fresh()->status);

        // Final delivered webhook completes order
        $this->postJson('/api/webhooks/shipping', [
            'event'               => 'order.status',
            'order_id'            => '5dd6da88f43bd430ecd5aa2e',
            'status'              => 'delivered',
            'courier_waybill_id'  => 'SKS-998877',
            'courier_tracking_id' => 'XYZ-123-PQS',
        ])->assertOk();

        $this->assertSame('delivered', $bast->fresh()->shipping_status);
        $this->assertSame('selesai', $bast->fresh()->status_bayar);
        $this->assertSame('selesai', $laporan->fresh()->status);
        $this->assertSame('Selesai', $temuan->fresh()->status_simpan);
    }

    public function test_biteship_failure_hold_and_return_statuses_are_handled_without_marking_completed(): void
    {
        config()->set('services.biteship.api_key', 'biteship_test.TestKey123');
        config()->set('services.shipping.webhook_secret', null);

        [, $logistik, $laporan, $klaim, $temuan] = $this->seedApprovedScenario();

        $bast = BastPengambilan::create([
            'kode'                    => 'BAST-2026-953',
            'klaim_id'                => $klaim->id,
            'metode_ambil'            => 'ekspedisi',
            'alamat_kirim'            => 'Jl. Merdeka No. 85, Bogor, 16610',
            'destination_postal_code' => '16610',
            'kurir'                   => 'JNE Reguler',
            'courier_company'         => 'jne',
            'courier_type'            => 'reg',
            'ongkir'                  => 21500,
            'status_bayar'            => 'dikemas',
            'nomor_resi'              => 'WYB-1795747045101',
            'biteship_order_id'       => 'bshp-order-953',
            'biteship_tracking_id'    => 'bshp-track-953',
        ]);

        // 1. courier_not_found -> gagal_kirim & Bermasalah in logistics inventory, NOT selesai
        $this->postJson('/api/webhooks/shipping', [
            'event'    => 'order.status',
            'order_id' => 'bshp-order-953',
            'status'   => 'courierNotFound',
        ])->assertOk();

        $this->assertSame('courier_not_found', $bast->fresh()->shipping_status);
        $this->assertSame('gagal_kirim', $bast->fresh()->status_bayar);
        $this->assertNotSame('selesai', $laporan->fresh()->status);

        $invRes = $this->actingAs($logistik)->getJson('/api/staff/logistics/inventory')->assertOk();
        $row = collect($invRes->json('shipments'))->firstWhere('bast_code', 'BAST-2026-953');
        $this->assertSame('Bermasalah', $row['status'] ?? null);
        $this->assertSame(21500, $row['ongkir'] ?? null);
        $this->assertSame('16610', $row['destination_postal_code'] ?? null);
        $this->assertArrayHasKey('tracking_history', $row ?? []);
        $this->assertSame('Headphone Hitam', $row['item_name'] ?? null);

        // 1b. order.price adjustment logs a price_updated timeline entry without disrupting status
        $this->postJson('/api/webhooks/shipping', [
            'event'    => 'order.price',
            'order_id' => 'bshp-order-953',
            'price'    => 92000,
        ])->assertOk()->assertJsonPath('ok', true);

        $freshAfterPrice = $bast->fresh();
        $this->assertSame('courier_not_found', $freshAfterPrice->shipping_status);
        $lastEntry = collect($freshAfterPrice->tracking_history)->last();
        $this->assertSame('price_updated', $lastEntry['status'] ?? null);
        $this->assertStringContainsString('Rp 92.000', $lastEntry['note'] ?? '');

        // 2. on_hold -> keeps non-completed status & marks shipping_status = on_hold
        $this->postJson('/api/webhooks/shipping', [
            'event'    => 'order.status',
            'order_id' => 'bshp-order-953',
            'status'   => 'onHold',
        ])->assertOk();
        $this->assertSame('on_hold', $bast->fresh()->shipping_status);
        $this->assertNotSame('selesai', $laporan->fresh()->status);

        // 3. returned -> status_bayar = retur & restores BarangTemuan to Tersimpan
        $this->postJson('/api/webhooks/shipping', [
            'event'    => 'order.status',
            'order_id' => 'bshp-order-953',
            'status'   => 'returned',
        ])->assertOk();
        $this->assertSame('returned', $bast->fresh()->shipping_status);
        $this->assertSame('retur', $bast->fresh()->status_bayar);
        $this->assertSame('Tersimpan', $temuan->fresh()->status_simpan);
        $this->assertNotSame('selesai', $laporan->fresh()->status);

        // 4. Staff can re-order via Biteship after courier_not_found
        Http::fake([
            'https://api.biteship.com/v1/orders' => Http::response([
                'success' => true,
                'id'      => 'bshp-order-953-retry',
                'status'  => 'confirmed',
                'courier' => [
                    'tracking_id' => 'bshp-track-953-retry',
                    'waybill_id'  => 'WYB-RETRY-953',
                ],
            ], 200),
        ]);

        $retryRes = $this->actingAs($logistik)->postJson("/api/staff/logistics/shipments/{$bast->id}/ship", [
            'awb'    => '',
            'action' => 'pack',
        ]);
        $retryRes->assertOk()->assertJsonPath('status', 'Dikemas')->assertJsonPath('awb', 'WYB-RETRY-953');
        $this->assertSame('confirmed', $bast->fresh()->shipping_status);
        $this->assertSame('dikemas', $bast->fresh()->status_bayar);
    }

    public function test_found_item_weight_and_dimensions_drive_biteship_rates_and_order(): void
    {
        config()->set('services.biteship.api_key', 'biteship_test.TestKey123');

        [$passenger, $logistik, $laporan, $klaim, $temuan] = $this->seedApprovedScenario();
        $cs = User::firstOrCreate(
            ['email' => 'rina.k@kci.id'],
            [
                'name'       => 'Rina Kurniasih',
                'password'   => bcrypt('password'),
                'role'       => 'cs',
                'stasiun_id' => $temuan->stasiun_temuan_id,
            ]
        );

        // 1. CS creates a new found item with explicit weight, dimensions, and value
        $createRes = $this->actingAs($cs)->postJson('/api/staff/cs/found-items', [
            'cat'             => 'Elektronik',
            'name'            => 'Kamera Mirrorless Fuji',
            'color'           => 'Hitam',
            'station'         => 'Jakarta Kota',
            'weight_grams'    => 1800,
            'length_cm'       => 30,
            'width_cm'        => 20,
            'height_cm'       => 15,
            'estimated_value' => 8500000,
        ]);
        $createRes->assertOk()
            ->assertJsonPath('item.weightGrams', 1800)
            ->assertJsonPath('item.lengthCm', 30)
            ->assertJsonPath('item.widthCm', 20)
            ->assertJsonPath('item.heightCm', 15)
            ->assertJsonPath('item.estimatedValue', 8500000);

        // 2. CS weighs & measures an item that is already Dalam Klaim
        $updateRes = $this->actingAs($cs)->patchJson("/api/staff/cs/found-items/{$temuan->kode}", [
            'weight_grams'    => 2500,
            'length_cm'       => 40,
            'width_cm'        => 30,
            'height_cm'       => 20,
            'estimated_value' => 5000000,
        ]);
        $updateRes->assertOk()
            ->assertJsonPath('item.weightGrams', 2500)
            ->assertJsonPath('item.lengthCm', 40)
            ->assertJsonPath('item.estimatedValue', 5000000);

        Http::fake([
            'https://api.biteship.com/v1/rates/couriers' => Http::response([
                'success' => true,
                'pricing' => [
                    [
                        'courier_name'            => 'JNE',
                        'courier_code'            => 'jne',
                        'courier_service_name'    => 'REG',
                        'courier_service_code'    => 'reg',
                        'shipment_duration_range' => '1 - 2',
                        'shipment_duration_unit'  => 'days',
                        'price'                   => 36000,
                    ],
                ],
            ], 200),
            'https://api.biteship.com/v1/orders' => Http::response([
                'success' => true,
                'id'      => 'bshp-order-dim-951',
                'status'  => 'confirmed',
                'courier' => [
                    'tracking_id' => 'bshp-track-dim-951',
                    'waybill_id'  => 'JNEDIM951',
                ],
            ], 200),
        ]);

        // 3. Rates query uses the found item's exact weight, dimensions, and value (volumetric = 40*30*20/6000 = 4000 g)
        $ratesRes = $this->actingAs($passenger)->postJson('/api/shipping/rates', [
            'postal_code' => '16143',
            'report_code' => $laporan->kode,
        ]);
        $ratesRes->assertOk()
            ->assertJsonPath('package.weight_grams', 2500)
            ->assertJsonPath('package.volumetric_grams', 4000)
            ->assertJsonPath('package.chargeable_grams', 4000)
            ->assertJsonPath('package.length_cm', 40)
            ->assertJsonPath('package.estimated_value', 5000000);

        Http::assertSent(function ($req) {
            if (! str_contains($req->url(), '/rates/couriers')) {
                return false;
            }
            $item = $req['items'][0] ?? [];

            return ($item['weight'] ?? null) === 2500
                && ($item['length'] ?? null) === 40
                && ($item['width'] ?? null) === 30
                && ($item['height'] ?? null) === 20
                && ($item['value'] ?? null) === 5000000;
        });

        // 4. Logistics order creation passes those exact dimensions and weight to Biteship /orders
        $bast = BastPengambilan::create([
            'kode'                    => 'BAST-2026-954',
            'klaim_id'                => $klaim->id,
            'metode_ambil'            => 'ekspedisi',
            'alamat_kirim'            => 'Jl. Pajajaran No. 12, Bogor Tengah, 16143',
            'destination_postal_code' => '16143',
            'recipient_name'          => 'M. Ramdhan Maulana',
            'recipient_phone'         => '081234567890',
            'kurir'                   => 'JNE REG',
            'courier_company'         => 'jne',
            'courier_type'            => 'reg',
            'ongkir'                  => 43500,
            'status_bayar'            => 'lunas',
        ]);

        $this->actingAs($logistik)->postJson("/api/staff/logistics/shipments/{$bast->id}/ship", [
            'awb'    => '',
            'action' => 'pack',
        ])->assertOk()->assertJsonPath('awb', 'JNEDIM951');

        Http::assertSent(function ($req) {
            if (! str_contains($req->url(), '/v1/orders')) {
                return false;
            }
            $item = $req['items'][0] ?? [];

            return ($item['weight'] ?? null) === 2500
                && ($item['length'] ?? null) === 40
                && ($item['width'] ?? null) === 30
                && ($item['height'] ?? null) === 20
                && ($item['value'] ?? null) === 5000000;
        });
    }

    public function test_payment_override_amount_overrides_checkout_and_midtrans_gross_amount(): void
    {
        config()->set('services.midtrans.server_key', 'SB-Mid-server-TestKey123');
        config()->set('services.midtrans.client_key', 'SB-Mid-client-TestKey123');
        config()->set('services.midtrans.override_amount', 1);
        config()->set('services.biteship.api_key', null);

        $this->getJson('/api/payment/config')
            ->assertOk()
            ->assertJsonPath('override_amount', 1);

        [$passenger, , $laporan] = $this->seedApprovedScenario();

        Http::fake([
            'https://app.sandbox.midtrans.com/snap/v1/transactions' => Http::response([
                'token'        => 'snap-override-1',
                'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v4/redirection/snap-override-1',
            ], 201),
        ]);

        $res = $this->actingAs($passenger)->postJson("/api/reports/{$laporan->kode}/bast", [
            'method'          => 'ekspedisi',
            'courier'         => 'JNE Reguler',
            'courier_company' => 'jne',
            'courier_type'    => 'reg',
            'address'         => 'Jl. Pajajaran No. 12',
            'city'            => 'Bogor Tengah',
            'zip'             => '16143',
            'name'            => 'M. Ramdhan',
            'wa'              => '081234567890',
            'insure'          => true,
        ]);

        $res->assertOk()
            ->assertJsonPath('report.shippingAmount', 1);

        Http::assertSent(function ($req) {
            if (! str_contains($req->url(), 'snap/v1/transactions')) {
                return false;
            }
            $gross = $req['transaction_details']['gross_amount'] ?? null;
            $items = $req['item_details'] ?? [];

            return $gross === 1 && count($items) === 1 && ($items[0]['price'] ?? null) === 1;
        });
    }
}
