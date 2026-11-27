<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BastPengambilan extends Model
{
    protected $table = 'bast_pengambilan';

    protected $fillable = [
        'kode', 'midtrans_order_id', 'klaim_id', 'kode_qr', 'metode_ambil',
        'stasiun_ambil_id', 'alamat_kirim', 'kurir', 'ongkir',
        'status_bayar', 'snap_token', 'payment_url', 'payment_type',
        'nomor_resi', 'waktu_serah_terima',
    ];

    protected function casts(): array
    {
        return [
            'waktu_serah_terima' => 'datetime',
        ];
    }

    public function klaim(): BelongsTo
    {
        return $this->belongsTo(KlaimVerifikasi::class, 'klaim_id');
    }

    public function stasiunAmbil(): BelongsTo
    {
        return $this->belongsTo(Stasiun::class, 'stasiun_ambil_id');
    }

    /**
     * Generate the next BAST code like BAST-2026-090.
     */
    public static function generateKode(): string
    {
        $year = now()->year;
        $last = static::where('kode', 'like', "BAST-{$year}-%")
            ->orderByDesc('kode')
            ->value('kode');

        if ($last) {
            $seq = (int) substr($last, -3) + 1;
        } else {
            $seq = 1;
        }

        return sprintf('BAST-%d-%03d', $year, $seq);
    }
}
