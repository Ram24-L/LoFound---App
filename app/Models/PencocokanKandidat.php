<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PencocokanKandidat extends Model
{
    protected $table = 'pencocokan_kandidat';

    protected $fillable = ['laporan_id', 'barang_temuan_id', 'skor_kecocokan', 'status_cocok'];

    public function laporan(): BelongsTo
    {
        return $this->belongsTo(LaporanBarangHilang::class, 'laporan_id');
    }

    public function barangTemuan(): BelongsTo
    {
        return $this->belongsTo(BarangTemuan::class, 'barang_temuan_id');
    }
}
