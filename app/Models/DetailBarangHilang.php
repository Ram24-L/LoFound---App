<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DetailBarangHilang extends Model
{
    protected $table = 'detail_barang_hilang';

    protected $fillable = ['laporan_id', 'sub_kode', 'kategori_id', 'nama_barang', 'warna'];

    public function laporan(): BelongsTo
    {
        return $this->belongsTo(LaporanBarangHilang::class, 'laporan_id');
    }

    public function kategori(): BelongsTo
    {
        return $this->belongsTo(KategoriBarang::class, 'kategori_id');
    }
}
