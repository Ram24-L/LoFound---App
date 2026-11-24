<?php

namespace App\Services;

use App\Models\BastPengambilan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PaymentGatewayService
{
    public function isConfigured(): bool
    {
        return ! empty(config('services.midtrans.server_key'));
    }

    public function createSnapTransaction(BastPengambilan $bast, array $customer): ?array
    {
        $serverKey = config('services.midtrans.server_key');
        if (! $serverKey) {
            return null;
        }

        $isProd = (bool) config('services.midtrans.is_production', false);
        $baseUrl = $isProd
            ? 'https://app.midtrans.com/snap/v1/transactions'
            : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

        try {
            $response = Http::timeout(10)
                ->withBasicAuth($serverKey, '')
                ->acceptJson()
                ->post($baseUrl, [
                    'transaction_details' => [
                        'order_id'     => $bast->kode,
                        'gross_amount' => (int) ($bast->ongkir ?? 25500),
                    ],
                    'customer_details' => [
                        'first_name' => $customer['name'] ?? 'Penumpang KRL',
                        'phone'      => $customer['wa'] ?? '',
                        'email'      => $customer['email'] ?? null,
                    ],
                ]);

            if ($response->successful()) {
                return [
                    'token'        => $response->json('token'),
                    'redirect_url' => $response->json('redirect_url'),
                ];
            }

            Log::warning('Midtrans Snap error', ['status' => $response->status(), 'body' => $response->body()]);
        } catch (\Throwable $e) {
            Log::error('Midtrans Snap request failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    public function verifyMidtransSignature(string $orderId, string $statusCode, string $grossAmount, string $signatureKey): bool
    {
        $serverKey = config('services.midtrans.server_key');
        if (! $serverKey || ! $signatureKey) {
            return false;
        }

        $expected = hash('sha512', $orderId . $statusCode . $grossAmount . $serverKey);
        return hash_equals($expected, $signatureKey);
    }
}
