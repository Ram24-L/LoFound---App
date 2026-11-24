<?php

namespace App\Services;

use App\Jobs\SendLoFoundNotification;
use App\Models\LaporanBarangHilang;

class NotificationService
{
    public static function sendOtp(string $contact, string $code): void
    {
        $isEmail = (bool) filter_var($contact, FILTER_VALIDATE_EMAIL);

        SendLoFoundNotification::dispatchSync(
            email: $isEmail ? $contact : null,
            phone: $isEmail ? null : $contact,
            title: 'Kode Verifikasi OTP LoFound',
            body: "Kode OTP Anda adalah: {$code}. Berlaku selama 5 menit. Jangan bagikan kode ini kepada siapa pun.",
            type: 'otp',
            otpCode: $code,
        );
    }

    /**
     * @param  array{tone?: string, details?: array<string, string>, action_url?: ?string, action_text?: string}  $extra
     */
    public static function notifyReport(LaporanBarangHilang $laporan, string $title, string $body, array $extra = []): void
    {
        if (! $laporan->notify) {
            return;
        }

        $laporan->loadMissing(['user', 'items', 'stasiunDari', 'stasiunKe']);
        $user = $laporan->user;
        if (! $user || ! $user->email) {
            return;
        }

        $itemName = $laporan->items
            ->map(fn ($item) => $item->warna ? "{$item->nama_barang} ({$item->warna})" : $item->nama_barang)
            ->filter()
            ->implode(', ') ?: null;

        $dari = $laporan->stasiunDari?->nama;
        $ke = $laporan->stasiunKe?->nama;
        $routeLabel = ($dari && $ke) ? "{$dari} → {$ke}" : ($ke ?: $dari);

        [$statusLabel, $defaultTone] = match ($laporan->status) {
            'diterima'    => ['Laporan Diterima', 'info'],
            'pencarian'   => ['Dalam Pencarian', 'info'],
            'kandidat'    => ['Kandidat Ditemukan', 'info'],
            'klaim'       => ['Menunggu Verifikasi', 'warning'],
            'perlu_info'  => ['Perlu Info Tambahan', 'warning'],
            'bast'        => ['BAST Diterbitkan', 'success'],
            'dikirim'     => ['Dalam Pengiriman', 'info'],
            'selesai'     => ['Selesai', 'success'],
            'ditolak'     => ['Klaim Ditolak', 'danger'],
            'dibatalkan'  => ['Dibatalkan', 'danger'],
            'kedaluwarsa' => ['Kedaluwarsa', 'warning'],
            default       => [ucfirst(str_replace('_', ' ', (string) $laporan->status)), 'info'],
        };

        SendLoFoundNotification::dispatch(
            email: $user->email,
            phone: null,
            title: $title,
            body: $body,
            type: 'report',
            meta: [
                'recipient_name' => $user->name,
                'report_code'    => $laporan->kode,
                'item_name'      => $itemName,
                'route_label'    => $routeLabel,
                'status_label'   => $statusLabel,
                'tone'           => $extra['tone'] ?? $defaultTone,
                'details'        => is_array($extra['details'] ?? null) ? $extra['details'] : [],
                'action_url'     => $extra['action_url'] ?? config('app.url'),
                'action_text'    => $extra['action_text'] ?? 'Lihat Detail Laporan',
            ],
        );
    }
}
