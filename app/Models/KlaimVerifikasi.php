<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class KlaimVerifikasi extends Model
{
    protected $table = 'klaim_verifikasi';

    protected $fillable = [
        'kode', 'laporan_id', 'barang_temuan_id', 'jawaban_rahasia',
        'bukti_tambahan', 'status_verifikasi', 'verified_by', 'catatan_cs',
    ];

    public function laporan(): BelongsTo
    {
        return $this->belongsTo(LaporanBarangHilang::class, 'laporan_id');
    }

    public function barangTemuan(): BelongsTo
    {
        return $this->belongsTo(BarangTemuan::class, 'barang_temuan_id');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function bast(): HasOne
    {
        return $this->hasOne(BastPengambilan::class, 'klaim_id');
    }

    /**
     * Generate the next claim code like KLM-2026-119.
     */
    public static function generateKode(): string
    {
        $year = now()->year;
        $last = static::where('kode', 'like', "KLM-{$year}-%")
            ->orderByDesc('kode')
            ->value('kode');

        if ($last) {
            $seq = (int) substr($last, -3) + 1;
        } else {
            $seq = 1;
        }

        return sprintf('KLM-%d-%03d', $year, $seq);
    }
}
