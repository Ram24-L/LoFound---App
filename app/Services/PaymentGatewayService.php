<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\BastPengambilan;
use App\Models\RiwayatLaporan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PaymentGatewayService
{
    public function isConfigured(): bool
    {
        return ! empty(config('services.midtrans.server_key'));
    }

    public function isProduction(): bool
    {
        return (bool) config('services.midtrans.is_production', false);
    }

    public function clientKey(): ?string
    {
        $key = config('services.midtrans.client_key');

        return is_string($key) && $key !== '' ? $key : null;
    }

    public function snapJsUrl(): string
    {
        return $this->isProduction()
            ? 'https://app.midtrans.com/snap/snap.js'
            : 'https://app.sandbox.midtrans.com/snap/snap.js';
    }

    public function apiBaseUrl(): string
    {
        return $this->isProduction()
            ? 'https://api.midtrans.com/v2'
            : 'https://api.sandbox.midtrans.com/v2';
    }

    /**
     * Build a signed payment return URL for the user's browser redirect callbacks.
     */
    public static function buildReturnUrl(string $baseUrl, string $kode, int $userId, int $ttlSeconds = 86400): string
    {
        $exp = (string) (time() + $ttlSeconds);
        $uid = (string) $userId;
        $sig = hash_hmac('sha256', "{$kode}|{$uid}|{$exp}", (string) config('app.key'));

        return rtrim($baseUrl, '/') . '/payment/return/' . rawurlencode($kode) . '?' . http_build_query([
            'uid' => $uid,
            'exp' => $exp,
            'sig' => $sig,
        ]);
    }

    /**
     * Verify a signed payment return URL regardless of extra gateway query params.
     */
    public static function verifyReturnSignature(string $kode, string $uid, string $exp, string $sig): bool
    {
        $key = (string) config('app.key');
        if ($key === '' || ! ctype_digit($uid) || ! ctype_digit($exp) || ! $sig) {
            return false;
        }

        if ((int) $exp < time()) {
            return false;
        }

        $expected = hash_hmac('sha256', "{$kode}|{$uid}|{$exp}", $key);

        return hash_equals($expected, $sig);
    }

    /**
     * Generate a unique Midtrans order_id (<= 50 chars) so retried checkouts never collide.
     */
    public function generateOrderId(string $bastKode): string
    {
        $suffix = now()->format('YmdHis') . '-' . substr(bin2hex(random_bytes(2)), 0, 4);

        return substr($bastKode, 0, 28) . '-' . $suffix;
    }

    /**
     * Create a Midtrans Snap transaction for a BAST shipping payment.
     *
     * @return array{ok: bool, order_id?: string, token?: string, redirect_url?: string, status?: int, error?: string}
     */
    public function createSnapTransaction(BastPengambilan $bast, array $customer, array $options = []): array
    {
        $serverKey = config('services.midtrans.server_key');
        if (! $serverKey) {
            return ['ok' => false, 'error' => 'Layanan pembayaran belum dikonfigurasi.'];
        }

        $snapUrl = $this->isProduction()
            ? 'https://app.midtrans.com/snap/v1/transactions'
            : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

        $orderId = (string) ($options['order_id'] ?? $bast->midtrans_order_id ?? $bast->kode);
        $grossAmount = (int) ($bast->ongkir ?? 25500);

        $customerDetails = array_filter([
            'first_name' => $customer['name'] ?? 'Penumpang KRL',
            'phone'      => $customer['wa'] ?? '',
            'email'      => $customer['email'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');

        if (! empty($options['shipping_address']) && is_array($options['shipping_address'])) {
            $customerDetails['shipping_address'] = array_filter([
                'first_name'   => $options['shipping_address']['first_name'] ?? ($customer['name'] ?? 'Penumpang KRL'),
                'phone'        => $options['shipping_address']['phone'] ?? ($customer['wa'] ?? ''),
                'address'      => $options['shipping_address']['address'] ?? '',
                'city'         => $options['shipping_address']['city'] ?? '',
                'postal_code'  => $options['shipping_address']['postal_code'] ?? '',
                'country_code' => 'IDN',
            ], fn ($v) => $v !== null && $v !== '');
        }

        $finishUrl = $options['finish_url'] ?? (rtrim((string) config('app.url'), '/') ?: '/');
        $unfinishUrl = $options['unfinish_url'] ?? $finishUrl;
        $errorUrl = $options['error_url'] ?? $finishUrl;

        $payload = [
            'transaction_details' => [
                'order_id'     => $orderId,
                'gross_amount' => $grossAmount,
            ],
            'customer_details' => $customerDetails,
            'callbacks' => [
                'finish'   => $finishUrl,
                'unfinish' => $unfinishUrl,
                'error'    => $errorUrl,
            ],
        ];

        if (! empty($options['item_details']) && is_array($options['item_details'])) {
            $payload['item_details'] = array_values($options['item_details']);
        }

        $payMethod = $options['pay_method'] ?? null;
        if ($payMethod === 'qris') {
            $payload['enabled_payments'] = [
                'other_qris', 'gopay', 'bca_va', 'bni_va', 'bri_va', 'echannel', 'permata_va', 'cimb_va',
            ];
        } elseif ($payMethod === 'ewallet') {
            $payload['enabled_payments'] = [
                'gopay', 'shopeepay', 'dana', 'other_qris',
            ];
        }

        try {
            $response = Http::timeout(15)
                ->withBasicAuth($serverKey, '')
                ->acceptJson()
                ->post($snapUrl, $payload);

            if ($response->successful()) {
                return [
                    'ok'           => true,
                    'order_id'     => $orderId,
                    'token'        => $response->json('token'),
                    'redirect_url' => $response->json('redirect_url'),
                ];
            }

            $errMessages = $response->json('error_messages');
            $errText = is_array($errMessages) && count($errMessages) > 0
                ? implode('; ', $errMessages)
                : ($response->json('status_message') ?? $response->body());

            Log::warning('Midtrans Snap error', [
                'order_id' => $orderId,
                'status'   => $response->status(),
                'body'     => $response->body(),
            ]);

            return [
                'ok'     => false,
                'status' => $response->status(),
                'error'  => is_string($errText) ? $errText : 'Layanan pembayaran mengembalikan respons gagal.',
            ];
        } catch (\Throwable $e) {
            Log::error('Midtrans Snap request failed', [
                'order_id' => $orderId,
                'error'    => $e->getMessage(),
            ]);

            return [
                'ok'    => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Fetch live transaction status from Midtrans Core Status API v2.
     */
    public function getTransactionStatus(string $orderId): ?array
    {
        $serverKey = config('services.midtrans.server_key');
        if (! $serverKey || ! $orderId) {
            return null;
        }

        try {
            $response = Http::timeout(15)
                ->withBasicAuth($serverKey, '')
                ->acceptJson()
                ->get($this->apiBaseUrl() . '/' . urlencode($orderId) . '/status');

            if ($response->successful()) {
                return $response->json();
            }

            Log::warning('Midtrans status check failed', [
                'order_id' => $orderId,
                'status'   => $response->status(),
                'body'     => $response->body(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Midtrans status request error', [
                'order_id' => $orderId,
                'error'    => $e->getMessage(),
            ]);
        }

        return null;
    }

    /**
     * Cancel an active pending transaction via Midtrans Core API v2.
     */
    public function cancelTransaction(string $orderId): bool
    {
        $serverKey = config('services.midtrans.server_key');
        if (! $serverKey || ! $orderId) {
            return false;
        }

        try {
            $response = Http::timeout(15)
                ->withBasicAuth($serverKey, '')
                ->acceptJson()
                ->post($this->apiBaseUrl() . '/' . urlencode($orderId) . '/cancel');

            // 404/412 indicates the user hasn't picked a Snap channel yet or tx is already closed.
            if ($response->successful() || in_array($response->status(), [404, 412], true)) {
                return true;
            }

            Log::warning('Midtrans cancel transaction failed', [
                'order_id' => $orderId,
                'status'   => $response->status(),
                'body'     => $response->body(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Midtrans cancel request error', [
                'order_id' => $orderId,
                'error'    => $e->getMessage(),
            ]);
        }

        return false;
    }

    /**
     * Apply a Midtrans transaction_status idempotently to BastPengambilan and LaporanBarangHilang.
     *
     * @return 'lunas'|'gagal'|'pending'
     */
    public function applyPaymentStatus(
        BastPengambilan $bast,
        string $txStatus,
        ?string $fraudStatus = null,
        ?string $paymentType = null,
        string $source = 'Payment Gateway',
    ): string {
        $bast->loadMissing(['klaim.laporan.user']);
        $laporan = $bast->klaim?->laporan;
        $statusNorm = strtolower(trim($txStatus));
        $fraudNorm = strtolower(trim((string) $fraudStatus));

        $isPaid = $statusNorm === 'settlement'
            || ($statusNorm === 'capture' && in_array($fraudNorm, ['', 'accept'], true));

        if ($isPaid) {
            $updateBast = ['status_bayar' => 'lunas'];
            if ($paymentType) {
                $updateBast['payment_type'] = $paymentType;
            }
            $bast->update($updateBast);

            if ($laporan && ! in_array($laporan->status, ['dikirim', 'selesai'], true)) {
                $laporan->update(['status' => 'dikirim']);
                RiwayatLaporan::create([
                    'laporan_id' => $laporan->id,
                    'waktu'      => now()->format('H:i'),
                    'keterangan' => "Pembayaran ongkir terkonfirmasi ({$bast->kode}). Paket diteruskan ke antrian logistik.",
                ]);
                NotificationService::notifyReport(
                    $laporan,
                    'Pembayaran Ongkir Diterima',
                    "Pembayaran ongkir untuk BAST {$bast->kode} telah lunas. Paket Anda sedang disiapkan oleh petugas logistik.",
                    ['details' => ['Kode BAST' => $bast->kode, 'Status Bayar' => 'Lunas']]
                );
                AuditLog::record(null, $source, 'Pembayaran ongkir lunas', $bast->kode);
            }

            return 'lunas';
        }

        if (in_array($statusNorm, ['expire', 'cancel', 'deny', 'failure'], true)) {
            if (! in_array($bast->status_bayar, ['lunas', 'selesai'], true)) {
                $bast->update([
                    'status_bayar' => 'gagal',
                    'payment_type' => $paymentType ?: $bast->payment_type,
                ]);
                AuditLog::record(null, $source, "Pembayaran {$statusNorm}", $bast->kode);
            }

            return 'gagal';
        }

        if (! in_array($bast->status_bayar, ['lunas', 'selesai'], true)) {
            $bast->update([
                'status_bayar' => 'pending',
                'payment_type' => $paymentType ?: $bast->payment_type,
            ]);
        }

        return 'pending';
    }

    public function verifyMidtransSignature(string $orderId, string $statusCode, string $grossAmount, string $signatureKey): bool
    {
        if (! $signatureKey) {
            return false;
        }

        $candidateKeys = array_values(array_unique(array_filter([
            trim((string) config('services.midtrans.signature_key')),
            trim((string) config('services.midtrans.server_key')),
        ], fn (string $k) => $k !== '')));

        if (count($candidateKeys) === 0) {
            return false;
        }

        foreach ($candidateKeys as $key) {
            $expected = hash('sha512', $orderId . $statusCode . $grossAmount . $key);
            if (hash_equals($expected, $signatureKey)) {
                return true;
            }
        }

        return false;
    }
}
