<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\BastPengambilan;
use App\Models\RiwayatLaporan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class BiteshipService
{
    public function isConfigured(): bool
    {
        return ! empty(config('services.biteship.api_key'));
    }

    public function isSandbox(): bool
    {
        return str_starts_with((string) config('services.biteship.api_key'), 'biteship_test');
    }

    public function baseUrl(): string
    {
        return rtrim((string) config('services.biteship.base_url', 'https://api.biteship.com/v1'), '/');
    }

    /**
     * Default fallback courier list when Biteship key is unset or temporarily unreachable.
     */
    public function fallbackCouriers(): array
    {
        return [
            [
                'k'       => 'KAI Logistik Express',
                'company' => 'kalog',
                'type'    => 'express',
                'price'   => 18000,
                'eta'     => '1–2 hari kerja',
                'tag'     => 'Tercepat',
                'desc'    => 'Layanan kilat resmi KAI Logistik',
                'source'  => 'fallback',
            ],
            [
                'k'       => 'JNE Reguler',
                'company' => 'jne',
                'type'    => 'reg',
                'price'   => 16000,
                'eta'     => '2–3 hari kerja',
                'tag'     => 'Populer',
                'desc'    => 'Pengiriman reguler ke seluruh kota',
                'source'  => 'fallback',
            ],
            [
                'k'       => 'Pos Indonesia',
                'company' => 'pos',
                'type'    => 'reg',
                'price'   => 14000,
                'eta'     => '3–4 hari kerja',
                'tag'     => 'Hemat',
                'desc'    => 'Tarif ekonomis & jangkauan luas',
                'source'  => 'fallback',
            ],
        ];
    }

    /**
     * Query Biteship /rates/couriers for real-time shipping rates by postal code.
     *
     * @return array{configured: bool, source: string, couriers: array<int, array<string, mixed>>}
     */
    public function getRates(string $destinationPostalCode, int $weightGrams = 1000, int $itemValue = 250000): array
    {
        $cleanZip = preg_replace('/\D+/', '', $destinationPostalCode) ?? '';
        $apiKey = (string) config('services.biteship.api_key', '');

        if (! $apiKey || strlen($cleanZip) !== 5) {
            return [
                'configured' => $this->isConfigured(),
                'source'     => 'fallback',
                'couriers'   => $this->fallbackCouriers(),
            ];
        }

        try {
            $response = Http::timeout(15)
                ->withHeaders([
                    'Authorization' => $apiKey,
                    'Accept'        => 'application/json',
                ])
                ->post($this->baseUrl() . '/rates/couriers', [
                    'origin_postal_code'      => (int) config('services.biteship.origin_postal_code', 11110),
                    'destination_postal_code' => (int) $cleanZip,
                    'couriers'                => (string) config('services.biteship.couriers', 'jne,pos,jnt,sicepat,anteraja'),
                    'items'                   => [
                        [
                            'name'     => 'Barang Temuan KRL',
                            'value'    => max(1000, $itemValue),
                            'weight'   => max(100, $weightGrams),
                            'quantity' => 1,
                        ],
                    ],
                ]);

            if (! $response->successful()) {
                Log::warning('Biteship rates API non-2xx', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);

                return [
                    'configured' => true,
                    'source'     => 'fallback',
                    'couriers'   => $this->fallbackCouriers(),
                ];
            }

            $pricing = $response->json('pricing');
            if (! is_array($pricing) || count($pricing) === 0) {
                return [
                    'configured' => true,
                    'source'     => 'fallback',
                    'couriers'   => $this->fallbackCouriers(),
                ];
            }

            $normalized = $this->normalizePricingList($pricing);
            if (count($normalized) === 0) {
                return [
                    'configured' => true,
                    'source'     => 'fallback',
                    'couriers'   => $this->fallbackCouriers(),
                ];
            }

            return [
                'configured' => true,
                'source'     => 'biteship',
                'couriers'   => $normalized,
            ];
        } catch (\Throwable $e) {
            Log::warning('Biteship rates request error', ['error' => $e->getMessage()]);

            return [
                'configured' => true,
                'source'     => 'fallback',
                'couriers'   => $this->fallbackCouriers(),
            ];
        }
    }

    /**
     * Create a Biteship courier order & waybill for a BAST expedition shipment.
     *
     * @return array{ok: bool, order_id?: string, tracking_id?: string|null, waybill_id?: string|null, status?: string, error?: string}
     */
    public function createOrder(BastPengambilan $bast): array
    {
        $apiKey = (string) config('services.biteship.api_key', '');
        if (! $apiKey) {
            return ['ok' => false, 'error' => 'Biteship API key belum dikonfigurasi.'];
        }

        $bast->loadMissing(['klaim.laporan.items', 'klaim.laporan.user']);
        $laporan = $bast->klaim?->laporan;
        $user = $laporan?->user;
        $itemName = $laporan?->items?->first()?->nama_barang ?: 'Barang Temuan KRL';

        [$company, $serviceType] = $this->resolveCourierPair($bast);

        $destPostal = preg_replace('/\D+/', '', (string) ($bast->destination_postal_code ?? '')) ?: '16143';
        $destName = $bast->recipient_name ?: ($user?->name ?: 'Penumpang KRL');
        $destPhone = $this->normalizePhone($bast->recipient_phone ?: ($user?->phone ?: '081234567890'));
        $destAddr = $bast->alamat_kirim ?: 'Bogor Tengah, Kota Bogor';

        $payload = [
            'shipper_contact_name'      => (string) config('services.biteship.origin_name', 'Posko CS LoFound KAI Commuter'),
            'shipper_contact_phone'     => $this->normalizePhone((string) config('services.biteship.origin_phone', '081212345678')),
            'shipper_organization'      => 'LoFound KAI Commuter',
            'origin_contact_name'       => (string) config('services.biteship.origin_name', 'Posko CS LoFound KAI Commuter'),
            'origin_contact_phone'      => $this->normalizePhone((string) config('services.biteship.origin_phone', '081212345678')),
            'origin_address'            => (string) config('services.biteship.origin_address', 'Posko CS Stasiun Jakarta Kota'),
            'origin_postal_code'        => (int) config('services.biteship.origin_postal_code', 11110),
            'destination_contact_name'  => $destName,
            'destination_contact_phone' => $destPhone,
            'destination_address'       => $destAddr,
            'destination_postal_code'   => (int) $destPostal,
            'courier_company'           => $company,
            'courier_type'              => $serviceType,
            'delivery_type'             => 'now',
            'reference_id'              => $bast->kode . '-' . now()->format('YmdHis') . '-' . substr(bin2hex(random_bytes(2)), 0, 4),
            'items'                     => [
                [
                    'name'        => substr($itemName, 0, 100),
                    'description' => "Pengiriman BAST {$bast->kode}",
                    'value'       => 250000,
                    'weight'      => 1000,
                    'quantity'    => 1,
                ],
            ],
        ];

        try {
            $response = Http::timeout(15)
                ->withHeaders([
                    'Authorization' => $apiKey,
                    'Accept'        => 'application/json',
                ])
                ->post($this->baseUrl() . '/orders', $payload);

            if (! $response->successful()) {
                $err = $response->json('error') ?? $response->json('message') ?? $response->body();
                Log::warning('Biteship createOrder failed', [
                    'bast'   => $bast->kode,
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);

                return [
                    'ok'    => false,
                    'error' => is_string($err) ? $err : 'Gagal membuat order ekspedisi di Biteship.',
                ];
            }

            $json = $response->json();
            $data = is_array($json['data'] ?? null) ? $json['data'] : $json;

            return [
                'ok'          => true,
                'order_id'    => (string) ($data['id'] ?? $json['id'] ?? ''),
                'tracking_id' => $data['courier']['tracking_id'] ?? $data['tracking_id'] ?? null,
                'waybill_id'  => $data['courier']['waybill_id'] ?? $data['waybill_id'] ?? null,
                'status'      => strtolower((string) ($data['status'] ?? 'confirmed')),
            ];
        } catch (\Throwable $e) {
            Log::error('Biteship createOrder error', [
                'bast'  => $bast->kode,
                'error' => $e->getMessage(),
            ]);

            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Fetch live tracking info from Biteship Tracking API (or Order API fallback).
     *
     * @return array{status: string, waybill_id: string|null, history: array<int, array<string, mixed>>}|null
     */
    public function getTracking(?string $trackingId, ?string $orderId = null): ?array
    {
        $apiKey = (string) config('services.biteship.api_key', '');
        if (! $apiKey || (! $trackingId && ! $orderId)) {
            return null;
        }

        try {
            $endpoint = $trackingId
                ? $this->baseUrl() . '/trackings/' . urlencode($trackingId)
                : $this->baseUrl() . '/orders/' . urlencode((string) $orderId);

            $response = Http::timeout(15)
                ->withHeaders([
                    'Authorization' => $apiKey,
                    'Accept'        => 'application/json',
                ])
                ->get($endpoint);

            if (! $response->successful() && $trackingId && $orderId) {
                $response = Http::timeout(15)
                    ->withHeaders([
                        'Authorization' => $apiKey,
                        'Accept'        => 'application/json',
                    ])
                    ->get($this->baseUrl() . '/orders/' . urlencode($orderId));
            }

            if (! $response->successful()) {
                Log::warning('Biteship tracking lookup failed', [
                    'tracking_id' => $trackingId,
                    'order_id'    => $orderId,
                    'status'      => $response->status(),
                ]);

                return null;
            }

            $json = $response->json();
            $data = is_array($json['data'] ?? null) ? $json['data'] : $json;

            $rawHistory = is_array($data['history'] ?? null) ? $data['history'] : [];
            $history = collect($rawHistory)
                ->map(fn ($h) => [
                    'status'     => strtolower((string) ($h['status'] ?? '')),
                    'note'       => (string) ($h['note'] ?? $h['status'] ?? ''),
                    'updated_at' => (string) ($h['updated_at'] ?? ''),
                ])
                ->filter(fn ($h) => $h['note'] !== '' || $h['status'] !== '')
                ->values()
                ->toArray();

            return [
                'status'     => strtolower((string) ($data['status'] ?? 'confirmed')),
                'waybill_id' => $data['waybill_id'] ?? $data['courier']['waybill_id'] ?? null,
                'history'    => $history,
            ];
        } catch (\Throwable $e) {
            Log::error('Biteship tracking request error', [
                'tracking_id' => $trackingId,
                'order_id'    => $orderId,
                'error'       => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Apply courier tracking status idempotently across BAST, Report, Inventory, and Notifications.
     */
    public function applyTrackingUpdate(
        BastPengambilan $bast,
        string $rawStatus,
        ?string $waybillId = null,
        array $history = [],
        string $source = 'Ekspedisi',
    ): string {
        $bast->loadMissing(['klaim.laporan.user', 'klaim.barangTemuan']);
        $laporan = $bast->klaim?->laporan;

        $normStatus = $rawStatus !== ''
            ? Str::snake(str_replace(['-', ' '], '_', trim($rawStatus)))
            : '';
        $updateBast = [];
        if ($normStatus !== '') {
            $updateBast['shipping_status'] = $normStatus;
        }

        if ($waybillId) {
            $updateBast['nomor_resi'] = strtoupper($waybillId);
        }
        if (count($history) > 0) {
            $updateBast['tracking_history'] = $history;
        }

        $awb = $updateBast['nomor_resi'] ?? $bast->nomor_resi;

        if ($normStatus === '') {
            if (count($updateBast) > 0) {
                $bast->update($updateBast);
            }
            if ($laporan && $awb) {
                $alreadyWaybill = RiwayatLaporan::where('laporan_id', $laporan->id)
                    ->where('keterangan', 'like', "%{$awb}%")
                    ->exists();
                if (! $alreadyWaybill) {
                    RiwayatLaporan::create([
                        'laporan_id' => $laporan->id,
                        'waktu'      => now()->format('H:i'),
                        'keterangan' => "Nomor resi kurir diterbitkan ({$awb}).",
                    ]);
                }
            }

            return $bast->shipping_status ?? 'confirmed';
        }

        if ($normStatus === 'delivered') {
            $updateBast['status_bayar'] = 'selesai';
            $updateBast['waktu_serah_terima'] = $bast->waktu_serah_terima ?? now();
            $bast->update($updateBast);

            if ($laporan && $laporan->status !== 'selesai') {
                $laporan->update(['status' => 'selesai']);
                if ($bast->klaim?->barangTemuan) {
                    $bast->klaim->barangTemuan->update(['status_simpan' => 'Selesai']);
                }
                RiwayatLaporan::create([
                    'laporan_id' => $laporan->id,
                    'waktu'      => now()->format('H:i'),
                    'keterangan' => "Paket ekspedisi ({$awb}) tiba di tujuan dan diterima penumpang. Selesai.",
                ]);
                NotificationService::notifyReport(
                    $laporan,
                    'Paket Telah Tiba',
                    "Paket dengan nomor resi {$awb} telah tiba di alamat tujuan. Terima kasih telah menggunakan LoFound.",
                    ['details' => ['Kode BAST' => $bast->kode, 'Nomor Resi' => $awb ?: '-']]
                );
                AuditLog::record(null, $source, 'Paket tiba di tujuan', "{$bast->kode} • {$awb}");
            }

            return 'delivered';
        }

        if (in_array($normStatus, ['picked', 'dropping_off', 'in_transit', 'on_hold'], true)) {
            if (! in_array($bast->status_bayar, ['selesai'], true)) {
                $updateBast['status_bayar'] = 'dikirim';
            }
            $bast->update($updateBast);

            if ($laporan && ! in_array($laporan->status, ['dikirim', 'selesai'], true)) {
                $laporan->update(['status' => 'dikirim']);
            }
            if ($laporan) {
                $alreadyLogged = RiwayatLaporan::where('laporan_id', $laporan->id)
                    ->where('keterangan', 'like', '%dalam perjalanan%')
                    ->exists();
                if (! $alreadyLogged) {
                    RiwayatLaporan::create([
                        'laporan_id' => $laporan->id,
                        'waktu'      => now()->format('H:i'),
                        'keterangan' => "Paket {$bast->kurir} (" . ($awb ?: $bast->kode) . ') sedang dalam perjalanan menuju alamat tujuan.',
                    ]);
                }
            }

            return $normStatus;
        }

        if (in_array($normStatus, ['courier_not_found', 'cancelled', 'rejected', 'disposed'], true)) {
            $updateBast['status_bayar'] = 'gagal_kirim';
            $bast->update($updateBast);

            if ($laporan && $laporan->status !== 'selesai') {
                if ($laporan->status === 'bast') {
                    $laporan->update(['status' => 'dikirim']);
                }

                $descMap = [
                    'courier_not_found' => 'Kurir tidak ditemukan untuk penjemputan. Petugas logistik akan menjadwalkan ulang penjemputan.',
                    'cancelled'         => 'Order pengiriman dibatalkan oleh pihak ekspedisi.',
                    'rejected'          => 'Paket ditolak saat proses pengiriman oleh penerima/kurir.',
                    'disposed'          => 'Paket gagal dikirim dan dinyatakan tidak dapat diteruskan oleh kurir.',
                ];
                $titleMap = [
                    'courier_not_found' => 'Kurir Penjemput Tidak Ditemukan',
                    'cancelled'         => 'Pengiriman Dibatalkan Kurir',
                    'rejected'          => 'Paket Ditolak Saat Pengiriman',
                    'disposed'          => 'Kendala Pengiriman Ekspedisi',
                ];
                $desc = $descMap[$normStatus] ?? "Kendala pengiriman ({$normStatus}).";

                $alreadyLogged = RiwayatLaporan::where('laporan_id', $laporan->id)
                    ->where('keterangan', 'like', "%{$desc}%")
                    ->exists();
                if (! $alreadyLogged) {
                    RiwayatLaporan::create([
                        'laporan_id' => $laporan->id,
                        'waktu'      => now()->format('H:i'),
                        'keterangan' => $desc . ($awb ? " ({$awb})" : ''),
                    ]);
                    NotificationService::notifyReport(
                        $laporan,
                        $titleMap[$normStatus] ?? 'Kendala Pengiriman Paket',
                        $desc,
                        ['details' => ['Kode BAST' => $bast->kode, 'Nomor Resi' => $awb ?: '-', 'Status' => $normStatus]]
                    );
                }
            }
            AuditLog::record(null, $source, "Kendala pengiriman: {$normStatus}", "{$bast->kode}" . ($awb ? " • {$awb}" : ''));

            return $normStatus;
        }

        if (in_array($normStatus, ['return_in_transit', 'returned'], true)) {
            $updateBast['status_bayar'] = 'retur';
            $bast->update($updateBast);

            if ($normStatus === 'returned' && $bast->klaim?->barangTemuan) {
                $bast->klaim->barangTemuan->update(['status_simpan' => 'Tersimpan']);
            }

            if ($laporan && $laporan->status !== 'selesai') {
                if ($laporan->status === 'bast') {
                    $laporan->update(['status' => 'dikirim']);
                }
                $desc = $normStatus === 'returned'
                    ? 'Paket gagal terkirim dan telah dikembalikan dengan aman ke Posko CS.'
                    : 'Paket gagal terkirim dan sedang dalam perjalanan kembali ke Posko CS.';
                $title = $normStatus === 'returned'
                    ? 'Paket Kembali ke Posko CS'
                    : 'Paket Sedang Dikembalikan ke Posko';

                $alreadyLogged = RiwayatLaporan::where('laporan_id', $laporan->id)
                    ->where('keterangan', 'like', "%{$desc}%")
                    ->exists();
                if (! $alreadyLogged) {
                    RiwayatLaporan::create([
                        'laporan_id' => $laporan->id,
                        'waktu'      => now()->format('H:i'),
                        'keterangan' => $desc . ($awb ? " ({$awb})" : ''),
                    ]);
                    NotificationService::notifyReport(
                        $laporan,
                        $title,
                        $desc,
                        ['details' => ['Kode BAST' => $bast->kode, 'Nomor Resi' => $awb ?: '-', 'Status' => $normStatus]]
                    );
                }
            }
            AuditLog::record(null, $source, "Retur pengiriman: {$normStatus}", "{$bast->kode}" . ($awb ? " • {$awb}" : ''));

            return $normStatus;
        }

        if ($normStatus === 'on_hold') {
            if (! in_array($bast->status_bayar, ['dikirim', 'selesai'], true)) {
                $updateBast['status_bayar'] = 'dikemas';
            }
            $bast->update($updateBast);

            if ($laporan && $laporan->status !== 'selesai') {
                $desc = 'Pengiriman tertunda sementara oleh pihak kurir dan akan dijadwalkan ulang.';
                $alreadyLogged = RiwayatLaporan::where('laporan_id', $laporan->id)
                    ->where('keterangan', 'like', '%tertunda sementara%')
                    ->exists();
                if (! $alreadyLogged) {
                    RiwayatLaporan::create([
                        'laporan_id' => $laporan->id,
                        'waktu'      => now()->format('H:i'),
                        'keterangan' => $desc . ($awb ? " ({$awb})" : ''),
                    ]);
                    NotificationService::notifyReport(
                        $laporan,
                        'Pengiriman Tertunda Sementara',
                        $desc,
                        ['details' => ['Kode BAST' => $bast->kode, 'Nomor Resi' => $awb ?: '-']]
                    );
                }
            }
            AuditLog::record(null, $source, 'Pengiriman tertunda (on_hold)', "{$bast->kode}" . ($awb ? " • {$awb}" : ''));

            return $normStatus;
        }

        if (! in_array($bast->status_bayar, ['dikirim', 'selesai'], true)) {
            $updateBast['status_bayar'] = 'dikemas';
        }
        $bast->update($updateBast);

        return $normStatus ?: 'confirmed';
    }

    /**
     * Normalize Biteship pricing rows into uniform UI courier options (max 6, sorted ascending by price).
     */
    private function normalizePricingList(array $pricing): array
    {
        $seen = [];
        $list = [];

        foreach ($pricing as $p) {
            if (! is_array($p)) {
                continue;
            }
            $company = strtolower((string) ($p['courier_code'] ?? $p['company'] ?? ''));
            $type = strtolower((string) ($p['courier_service_code'] ?? $p['type'] ?? ''));
            $price = (int) ($p['price'] ?? 0);

            if ($company === '' || $type === '' || $price <= 0) {
                continue;
            }

            $key = "{$company}:{$type}";
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;

            $courierName = trim((string) ($p['courier_name'] ?? strtoupper($company)));
            $serviceName = trim((string) ($p['courier_service_name'] ?? strtoupper($type)));
            $displayCourier = str_starts_with(strtolower($serviceName), strtolower($courierName))
                ? $serviceName
                : "{$courierName} {$serviceName}";
            $eta = $this->formatEta($p);
            $minHours = $this->estimateMinHours($p);

            $list[] = [
                'k'         => $displayCourier,
                'company'   => $company,
                'type'      => $type,
                'price'     => $price,
                'eta'       => $eta,
                'tag'       => '',
                'desc'      => (string) ($p['description'] ?? "Layanan {$serviceName} dari {$courierName}"),
                'source'    => 'biteship',
                '_minHours' => $minHours,
            ];
        }

        usort($list, fn ($a, $b) => $a['price'] <=> $b['price']);
        $list = array_slice($list, 0, 6);

        if (count($list) > 0) {
            $list[0]['tag'] = 'Hemat';

            $fastestIdx = 0;
            $minH = $list[0]['_minHours'];
            foreach ($list as $idx => $item) {
                if ($item['_minHours'] < $minH) {
                    $minH = $item['_minHours'];
                    $fastestIdx = $idx;
                }
            }
            if ($fastestIdx !== 0 || count($list) === 1) {
                $list[$fastestIdx]['tag'] = 'Tercepat';
            }

            foreach ($list as $idx => $item) {
                if ($list[$idx]['tag'] === '' && in_array($item['type'], ['reg', 'reguler', 'ez', 'ctc'], true)) {
                    $list[$idx]['tag'] = 'Populer';
                    break;
                }
            }
        }

        return array_map(function ($item) {
            unset($item['_minHours']);

            return $item;
        }, $list);
    }

    private function formatEta(array $p): string
    {
        $duration = trim((string) ($p['duration'] ?? ''));
        if ($duration !== '') {
            return str_ireplace(['days', 'day', 'hours', 'hour'], ['hari kerja', 'hari kerja', 'jam', 'jam'], $duration);
        }

        $range = trim((string) ($p['shipment_duration_range'] ?? ''));
        $unit = strtolower(trim((string) ($p['shipment_duration_unit'] ?? 'days')));
        if ($range !== '') {
            $idUnit = $unit === 'hours' ? 'jam' : 'hari kerja';

            return "{$range} {$idUnit}";
        }

        return '2–3 hari kerja';
    }

    private function estimateMinHours(array $p): int
    {
        $range = (string) ($p['shipment_duration_range'] ?? $p['duration'] ?? '48');
        $unit = strtolower((string) ($p['shipment_duration_unit'] ?? 'days'));
        if (preg_match('/(\d+)/', $range, $m)) {
            $num = (int) $m[1];
            if (str_contains((string) ($p['duration'] ?? ''), 'hour') || $unit === 'hours') {
                return $num;
            }

            return $num * 24;
        }

        return 48;
    }

    private function resolveCourierPair(BastPengambilan $bast): array
    {
        $company = strtolower((string) ($bast->courier_company ?? ''));
        $type = strtolower((string) ($bast->courier_type ?? ''));

        if ($company !== '' && $company !== 'kalog' && $type !== '') {
            return [$company, $type];
        }

        $label = strtolower((string) $bast->kurir);
        if (str_contains($label, 'pos')) {
            return ['pos', 'reg'];
        }
        if (str_contains($label, 'sicepat')) {
            return ['sicepat', 'reg'];
        }
        if (str_contains($label, 'j&t') || str_contains($label, 'jnt')) {
            return ['jnt', 'ez'];
        }

        return ['jne', 'reg'];
    }

    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (str_starts_with($digits, '62')) {
            return $digits;
        }
        if (str_starts_with($digits, '0')) {
            return '62' . substr($digits, 1);
        }

        return $digits !== '' ? $digits : '6281234567890';
    }
}
