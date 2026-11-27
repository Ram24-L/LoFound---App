<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\BastPengambilan;
use App\Models\RiwayatLaporan;
use App\Services\BiteshipService;
use App\Services\NotificationService;
use App\Services\PaymentGatewayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WebhookController extends Controller
{
    /**
     * GET|POST /api/webhooks/payment — Midtrans payment gateway callback.
     */
    public function payment(Request $request, PaymentGatewayService $pg): JsonResponse
    {
        if ($request->isMethod('get')) {
            return response()->json(['ok' => true, 'service' => 'payment-webhook']);
        }

        $orderId = (string) $request->input('order_id', '');
        $statusCode = (string) $request->input('status_code', '');
        $grossAmount = (string) $request->input('gross_amount', '');
        $signatureKey = (string) $request->input('signature_key', '');

        $sigValid = $pg->verifyMidtransSignature($orderId, $statusCode, $grossAmount, $signatureKey);

        if (str_starts_with($orderId, 'payment_notif_test_')) {
            Log::info('Midtrans test webhook acknowledged', [
                'order_id'        => $orderId,
                'merchant_id'     => $request->input('merchant_id'),
                'signature_valid' => $sigValid,
            ]);

            return response()->json([
                'ok'              => true,
                'test'            => true,
                'signature_valid' => $sigValid,
            ]);
        }

        if (! $sigValid) {
            Log::warning('Midtrans webhook invalid signature', [
                'order_id'     => $orderId,
                'status_code'  => $statusCode,
                'gross_amount' => $grossAmount,
            ]);

            return response()->json(['message' => 'Invalid payment signature.'], 403);
        }

        $bast = BastPengambilan::with(['klaim.laporan.user'])
            ->where('midtrans_order_id', $orderId)
            ->orWhere('kode', $orderId)
            ->first();

        if (! $bast) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        $txStatus = strtolower((string) $request->input('transaction_status', ''));
        $fraudStatus = $request->input('fraud_status');
        $paymentType = $request->input('payment_type');

        $appliedStatus = $pg->applyPaymentStatus(
            $bast,
            $txStatus,
            is_string($fraudStatus) ? $fraudStatus : null,
            is_string($paymentType) ? $paymentType : null,
            'Payment Gateway'
        );

        Log::info('Midtrans webhook processed', [
            'order_id'       => $orderId,
            'bast'           => $bast->kode,
            'tx_status'      => $txStatus,
            'applied_status' => $appliedStatus,
        ]);

        return response()->json(['ok' => true]);
    }

    /**
     * GET|POST /api/webhooks/shipping — Logistics / courier / Biteship tracking callback.
     */
    public function shipping(Request $request, BiteshipService $biteship): JsonResponse
    {
        if ($request->isMethod('get')) {
            return response()->json(['ok' => true, 'service' => 'shipping-webhook']);
        }

        $secret = config('services.shipping.webhook_secret');
        $header = (string) ($request->header('X-Webhook-Secret') ?: $request->query('secret', ''));

        $payload = $request->all();
        $isBiteshipPayload = $request->filled('event')
            || $request->has('order_id')
            || $request->has('data.order_id')
            || $request->has('courier_tracking_id')
            || $request->has('courier_waybill_id')
            || count($payload) === 0;

        if ($isBiteshipPayload) {
            if ($secret && $header !== '' && ! hash_equals($secret, $header)) {
                return response()->json(['message' => 'Unauthorized webhook secret.'], 403);
            }

            $event = strtolower((string) $request->input('event', ''));

            // Biteship dashboard ping / verification request
            if (count($payload) === 0 || $event === 'test') {
                return response()->json(['ok' => true]);
            }

            if ($event === 'order.price') {
                $orderId = (string) ($request->input('order_id') ?? $request->input('data.order_id') ?? '');
                $price = $request->input('price') ?? $request->input('data.price');

                Log::info('Biteship order.price webhook received', [
                    'order_id' => $orderId,
                    'price'    => $price,
                ]);

                if ($orderId !== '') {
                    $bast = BastPengambilan::where('biteship_order_id', $orderId)->first();
                    if ($bast) {
                        $history = $bast->tracking_history ?? [];
                        $priceNote = ($price !== null && is_numeric($price))
                            ? 'Penyesuaian ongkir kurir menjadi Rp ' . number_format((int) $price, 0, ',', '.') . ' berdasarkan berat/volume aktual di ekspedisi.'
                            : 'Terdapat penyesuaian ongkir dari pihak ekspedisi.';
                        $history[] = [
                            'status'     => 'price_updated',
                            'note'       => $priceNote,
                            'updated_at' => (string) ($request->input('updated_at') ?? $request->input('data.updated_at') ?? now()->toIso8601String()),
                        ];
                        $bast->tracking_history = $history;
                        $bast->save();

                        AuditLog::record(null, 'Biteship Webhook', 'Penyesuaian ongkir kurir', "{$bast->kode} • {$priceNote}");
                    }
                }

                return response()->json(['ok' => true]);
            }

            $data = is_array($request->input('data')) ? $request->input('data') : $payload;
            $orderId = (string) ($data['order_id'] ?? $request->input('order_id', ''));
            $trackingId = (string) (
                $data['courier_tracking_id']
                ?? $request->input('courier_tracking_id')
                ?? $data['courier']['tracking_id']
                ?? $data['tracking_id']
                ?? $request->input('tracking_id', '')
            );
            $waybillId = $data['courier_waybill_id']
                ?? $request->input('courier_waybill_id')
                ?? $data['courier']['waybill_id']
                ?? $data['waybill_id']
                ?? $request->input('waybill_id');
            $status = (string) ($data['status'] ?? $request->input('status', ''));

            $bast = BastPengambilan::with(['klaim.laporan.user', 'klaim.barangTemuan'])
                ->where(function ($q) use ($orderId, $trackingId, $waybillId) {
                    if ($orderId !== '') {
                        $q->orWhere('biteship_order_id', $orderId);
                    }
                    if ($trackingId !== '') {
                        $q->orWhere('biteship_tracking_id', $trackingId);
                    }
                    if (is_string($waybillId) && $waybillId !== '') {
                        $q->orWhere('nomor_resi', strtoupper($waybillId));
                    }
                })
                ->first();

            if (! $bast) {
                return response()->json(['ok' => true, 'ignored' => true]);
            }

            if ($trackingId !== '' && ! $bast->biteship_tracking_id) {
                $bast->update(['biteship_tracking_id' => $trackingId]);
            }

            $history = $bast->tracking_history ?? [];
            if ($status !== '' || ! empty($data['note']) || (is_string($waybillId) && $waybillId !== '')) {
                $history[] = [
                    'status'     => strtolower($status ?: ($event ?: 'updated')),
                    'note'       => (string) ($data['note'] ?? ($waybillId && $status === '' ? "Resi kurir terbit: {$waybillId}" : $status)),
                    'updated_at' => (string) ($data['updated_at'] ?? now()->toIso8601String()),
                ];
            }

            $rawStatusForUpdate = $event === 'order.waybill_id' && $status === ''
                ? ''
                : ($status !== '' ? $status : 'confirmed');

            $applied = $biteship->applyTrackingUpdate(
                $bast,
                $rawStatusForUpdate,
                is_string($waybillId) ? $waybillId : null,
                $history,
                'Biteship Webhook'
            );

            Log::info('Biteship webhook processed', [
                'event'    => $event ?: 'status',
                'order_id' => $orderId,
                'bast'     => $bast->kode,
                'status'   => $applied,
            ]);

            return response()->json(['ok' => true]);
        }

        if (! $secret || ! hash_equals($secret, $header)) {
            return response()->json(['message' => 'Unauthorized webhook secret.'], 403);
        }

        $awb = strtoupper((string) $request->input('awb', ''));
        $status = strtolower((string) $request->input('status', ''));

        $bast = BastPengambilan::with(['klaim.laporan.user', 'klaim.barangTemuan'])
            ->where('nomor_resi', $awb)
            ->firstOrFail();

        $laporan = $bast->klaim?->laporan;

        if ($status === 'delivered') {
            $bast->update([
                'status_bayar'       => 'selesai',
                'waktu_serah_terima' => now(),
            ]);

            if ($laporan) {
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
                    ['details' => ['Kode BAST' => $bast->kode, 'Nomor Resi' => $awb]]
                );
            }

            AuditLog::record(null, 'Courier Webhook', 'Paket tiba di tujuan', "{$bast->kode} • {$awb}");
        }

        return response()->json(['ok' => true]);
    }
}
