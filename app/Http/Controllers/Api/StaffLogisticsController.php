<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\BarangTemuan;
use App\Models\BastPengambilan;
use App\Models\RiwayatLaporan;
use App\Services\BiteshipService;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class StaffLogisticsController extends Controller
{
    /**
     * GET /api/staff/logistics/inventory
     * Returns warehouse inventory and shipments queue (BAST with expedition method).
     */
    public function inventory(Request $request)
    {
        // 1. Expedition shipments from BAST
        $shipments = BastPengambilan::with([
            'klaim.laporan.user',
            'klaim.laporan.items',
            'klaim.laporan.stasiunKe',
            'klaim.barangTemuan.stasiunTemuan',
        ])
            ->where('metode_ambil', 'ekspedisi')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($bast) {
                $laporan = $bast->klaim?->laporan;
                $user = $laporan?->user;
                $barang = $bast->klaim?->barangTemuan;
                $originStasiun = $barang?->stasiunTemuan ?? $laporan?->stasiunKe;

                // Status mapping:
                // Failed/returned shipping statuses -> 'Bermasalah'
                // Delivered -> 'Selesai'
                // Has AWB & status_bayar === 'dikemas' -> 'Dikemas', else 'Dikirim'
                $problemStatuses = ['courier_not_found', 'cancelled', 'rejected', 'disposed', 'return_in_transit', 'returned'];
                $status = 'Menunggu Resi';
                if ($bast->waktu_serah_terima || ($laporan && $laporan->status === 'selesai')) {
                    $status = 'Selesai';
                } elseif (in_array($bast->shipping_status, $problemStatuses, true) || in_array($bast->status_bayar, ['gagal_kirim', 'retur'], true)) {
                    $status = 'Bermasalah';
                } elseif ($bast->nomor_resi) {
                    $status = ($bast->status_bayar === 'dikemas') ? 'Dikemas' : 'Dikirim';
                }

                return [
                    'id'                      => $bast->id,
                    'no'                      => $laporan ? $laporan->kode : $bast->kode,
                    'bast_code'               => $bast->kode,
                    'item_name'               => $barang?->nama_barang ?: ($laporan?->items?->first()?->nama_barang ?? 'Barang Temuan'),
                    'recipient'               => $bast->recipient_name ?: ($user ? $user->name : 'Penumpang KRL'),
                    'recipient_phone'         => $bast->recipient_phone ?: ($user?->phone ?? null),
                    'courier'                 => $bast->kurir ?? 'KAI Logistik Express',
                    'dest'                    => $bast->alamat_kirim ?? 'Bogor Tengah, Bogor',
                    'destination_postal_code' => $bast->destination_postal_code,
                    'ongkir'                  => (int) ($bast->ongkir ?? 0),
                    'paid'                    => $bast->created_at->format('j M, H:i'),
                    'status'                  => $status,
                    'payment_status'          => $bast->status_bayar,
                    'awb'                     => $bast->nomor_resi,
                    'biteship_order_id'       => $bast->biteship_order_id,
                    'biteship_tracking_id'    => $bast->biteship_tracking_id,
                    'shipping_status'         => $bast->shipping_status,
                    'tracking_history'        => $bast->tracking_history ?? [],
                    'weight_grams'            => $barang ? (int) ($barang->berat_gram ?? 1000) : 1000,
                    'length_cm'               => $barang?->panjang_cm ? (int) $barang->panjang_cm : null,
                    'width_cm'                => $barang?->lebar_cm ? (int) $barang->lebar_cm : null,
                    'height_cm'               => $barang?->tinggi_cm ? (int) $barang->tinggi_cm : null,
                    'estimated_value'         => $barang ? (int) ($barang->estimasi_nilai ?? 250000) : 250000,
                    'origin_station'          => $originStasiun?->nama ?? 'Jakarta Kota',
                    'origin_station_code'     => $originStasiun?->kode,
                    'origin_postal_code'      => $originStasiun?->kode_pos,
                    'origin_address'          => $originStasiun?->alamat_posko,
                    'origin_phone'            => $originStasiun?->telepon_posko,
                ];
            });

        // 2. Storage items
        $items = BarangTemuan::with(['kategori', 'stasiunTemuan'])
            ->where('status_simpan', '!=', 'Diarsipkan')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($bt) {
                return [
                    'id'        => $bt->id,
                    'code'      => $bt->kode,
                    'cat'       => $bt->kategori?->nama ?? '',
                    'name'      => $bt->nama_barang,
                    'station'   => $bt->stasiunTemuan?->nama ?? '',
                    'status'    => $bt->status_simpan,
                    'locker'    => $bt->secret['locker'] ?? 'Belum ditentukan',
                    'expiresIn' => $bt->expires_in,
                ];
            });

        return response()->json([
            'shipments' => $shipments,
            'items'     => $items,
        ]);
    }

    /**
     * PATCH /api/staff/logistics/found-items/{id}
     * Update warehouse rack / locker location or mutation status.
     */
    public function updateItem(Request $request, int $id)
    {
        $bt = BarangTemuan::findOrFail($id);
        $user = $request->user();

        $secret = $bt->secret ?? [];
        if ($request->has('locker')) {
            $secret['locker'] = $request->locker;
        }
        if ($request->has('notes')) {
            $secret['notes'] = $request->notes;
        }

        $bt->secret = $secret;
        if ($request->has('status')) {
            $bt->status_simpan = $request->status;
        }
        $bt->save();

        AuditLog::record($user->id, $user->name . ' (Logistik)', 'Update lokasi penyimpanan', "{$bt->kode} • " . ($secret['locker'] ?? ''));

        return response()->json(['item' => $bt]);
    }

    /**
     * POST /api/staff/logistics/shipments/{id}/ship
     * Input tracking number (AWB / Resi) and mark shipment as shipped.
     */
    public function shipOrder(Request $request, int $id, BiteshipService $biteship)
    {
        $request->validate([
            'awb'    => 'nullable|string',
            'action' => 'nullable|string', // 'pack', 'ship', or 'delivered'
        ]);

        $bast = BastPengambilan::with(['klaim.laporan', 'klaim.barangTemuan'])->findOrFail($id);
        $user = $request->user();
        $action = $request->input('action', 'ship');
        $manualAwb = trim((string) $request->input('awb', ''));

        if ($action === 'pack' && $manualAwb === '' && $biteship->isConfigured()) {
            $order = $biteship->createOrder($bast);
            if (! ($order['ok'] ?? false)) {
                return response()->json([
                    'message' => $order['error'] ?? 'Gagal membuat order ekspedisi di Biteship.',
                ], 502);
            }

            $bast->biteship_order_id = $order['order_id'] ?: null;
            $bast->biteship_tracking_id = $order['tracking_id'] ?: null;
            $bast->shipping_status = $order['status'] ?: 'confirmed';
            $bast->tracking_history = [[
                'status'     => $bast->shipping_status,
                'note'       => 'Order pengiriman baru dikonfirmasi',
                'updated_at' => now()->toIso8601String(),
            ]];

            $cleanOrderSuffix = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $order['order_id']) ?: Str::random(8));
            $awb = strtoupper((string) ($order['waybill_id'] ?: ('BSHP-' . substr($cleanOrderSuffix, -8))));
        } else {
            $awb = strtoupper($manualAwb ?: ($bast->nomor_resi ?: 'KALOG-' . rand(10000000, 99999999) . 'ID'));
        }

        // Check AWB duplicate
        $dup = BastPengambilan::where('nomor_resi', $awb)
            ->where('id', '!=', $bast->id)
            ->first();
        if ($dup) {
            return response()->json(['message' => 'Nomor resi sudah dipakai pada pengiriman lain.'], 422);
        }

        $bast->nomor_resi = $awb;
        if ($action === 'pack') {
            $bast->status_bayar = 'dikemas';
        } elseif ($action === 'ship') {
            $bast->status_bayar = 'dikirim';
        } elseif ($action === 'delivered') {
            $bast->status_bayar = 'selesai';
            $bast->waktu_serah_terima = now();
        }
        $bast->save();

        $laporan = $bast->klaim?->laporan;
        if ($laporan) {
            if ($action === 'delivered') {
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
                    "Paket ekspedisi ({$awb}) telah tiba di tujuan. Status laporan Anda kini Selesai.",
                    ['details' => ['Kurir' => $bast->kurir ?: '-', 'Nomor Resi' => $awb]]
                );
            } elseif ($action === 'ship') {
                $laporan->update(['status' => 'dikirim']);
                RiwayatLaporan::create([
                    'laporan_id' => $laporan->id,
                    'waktu'      => now()->format('H:i'),
                    'keterangan' => "Diserahkan ke kurir {$bast->kurir}. Resi: {$awb}.",
                ]);
                NotificationService::notifyReport(
                    $laporan,
                    'Paket Diserahkan ke Kurir',
                    "Paket Anda telah diserahkan ke {$bast->kurir} dengan nomor resi {$awb}.",
                    ['details' => ['Kurir' => $bast->kurir ?: '-', 'Nomor Resi' => $awb]]
                );
            } else {
                RiwayatLaporan::create([
                    'laporan_id' => $laporan->id,
                    'waktu'      => now()->format('H:i'),
                    'keterangan' => "Nomor resi {$awb} diterbitkan. Paket sedang dikemas.",
                ]);
            }
        }

        $actLabel = $action === 'delivered' ? 'Konfirmasi paket tiba (Selesai)' : ($action === 'ship' ? 'Serahkan ke kurir' : 'Input resi pengiriman');
        AuditLog::record($user->id, $user->name . ' (Logistik)', $actLabel, "{$laporan?->kode} • Resi {$awb}");

        $statusLabel = match ($action) {
            'delivered' => 'Selesai',
            'ship'      => 'Dikirim',
            default     => 'Dikemas',
        };

        return response()->json([
            'bast'    => $bast,
            'status'  => $statusLabel,
            'awb'     => $awb,
            'message' => $action === 'delivered'
                ? 'Pengiriman telah selesai: Paket telah diterima penumpang.'
                : ($action === 'ship' ? 'Ditandai sudah diserahkan ke kurir.' : 'Resi pengiriman disimpan.'),
        ]);
    }

    /**
     * POST /api/logistics/shipments/{id}/sync-tracking — pull latest tracking status from Biteship
     */
    public function syncTracking(Request $request, int $id, BiteshipService $biteship)
    {
        $bast = BastPengambilan::findOrFail($id);

        if (! $biteship->isConfigured()) {
            return response()->json(['message' => 'Biteship API key belum dikonfigurasi.'], 422);
        }

        if (! $bast->biteship_tracking_id && ! $bast->biteship_order_id) {
            return response()->json(['message' => 'Pengiriman ini belum memiliki Order ID Biteship.'], 422);
        }

        $tracking = $biteship->getTracking($bast->biteship_tracking_id, $bast->biteship_order_id);
        if (! $tracking) {
            return response()->json(['message' => 'Gagal mengambil status tracking dari Biteship.'], 502);
        }

        $user = $request->user();
        $status = $biteship->applyTrackingUpdate(
            $bast,
            $tracking['status'],
            $tracking['waybill_id'] ?? null,
            $tracking['history'] ?? [],
            $user->name . ' (Biteship Sync)'
        );

        return response()->json([
            'ok'              => true,
            'shipping_status' => $status,
            'awb'             => $bast->fresh()->nomor_resi,
            'history'         => $tracking['history'] ?? [],
        ]);
    }
}
