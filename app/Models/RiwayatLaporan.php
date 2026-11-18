<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiwayatLaporan extends Model
{
    protected $table = 'riwayat_laporan';

    protected $fillable = ['laporan_id', 'waktu', 'keterangan'];

    public function laporan(): BelongsTo
    {
        return $this->belongsTo(LaporanBarangHilang::class, 'laporan_id');
    }
}
