<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\BastPengambilan;
use App\Models\RiwayatLaporan;
use App\Services\NotificationService;
use App\Services\PaymentGatewayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebhookController extends Controller
{
    /**
     * POST /api/webhooks/payment — Midtrans payment gateway callback.
     */
    public function payment(Request $request, PaymentGatewayService $pg): JsonResponse
    {
        $orderId = (string) $request->input('order_id', '');
        $statusCode = (string) $request->input('status_code', '');
        $grossAmount = (string) $request->input('gross_amount', '');
        $signatureKey = (string) $request->input('signature_key', '');

        if (! $pg->verifyMidtransSignature($orderId, $statusCode, $grossAmount, $signatureKey)) {
            return response()->json(['message' => 'Invalid payment signature.'], 403);
        }

        $bast = BastPengambilan::with(['klaim.laporan.user'])->where('kode', $orderId)->firstOrFail();
        $txStatus = strtolower((string) $request->input('transaction_status', ''));
        $laporan = $bast->klaim?->laporan;

        if (in_array($txStatus, ['settlement', 'capture'])) {
            $bast->update(['status_bayar' => 'lunas']);

            if ($laporan && $laporan->status !== 'dikirim' && $laporan->status !== 'selesai') {
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
            }

            AuditLog::record(null, 'Payment Gateway', 'Webhook pembayaran lunas', $bast->kode);
        } elseif (in_array($txStatus, ['expire', 'cancel', 'deny'])) {
            $bast->update(['status_bayar' => 'gagal']);
            AuditLog::record(null, 'Payment Gateway', "Webhook pembayaran {$txStatus}", $bast->kode);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * POST /api/webhooks/shipping — Logistics / courier tracking callback.
     */
    public function shipping(Request $request): JsonResponse
    {
        $secret = config('services.shipping.webhook_secret');
        $header = (string) $request->header('X-Webhook-Secret', '');

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
