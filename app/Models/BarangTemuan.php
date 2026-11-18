<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BarangTemuan extends Model
{
    protected $table = 'barang_temuan';

    protected $fillable = [
        'kode', 'petugas_id', 'stasiun_temuan_id', 'kategori_id',
        'nama_barang', 'warna', 'lokasi_spesifik', 'tanggal_temuan',
        'waktu_temuan', 'foto_barang', 'ciri_kunci', 'status_simpan',
        'expires_in', 'secret',
    ];

    protected function casts(): array
    {
        return [
            'tanggal_temuan' => 'date',
            'secret' => 'array',
        ];
    }

    public function petugas(): BelongsTo
    {
        return $this->belongsTo(User::class, 'petugas_id');
    }

    public function stasiunTemuan(): BelongsTo
    {
        return $this->belongsTo(Stasiun::class, 'stasiun_temuan_id');
    }

    public function kategori(): BelongsTo
    {
        return $this->belongsTo(KategoriBarang::class, 'kategori_id');
    }

    public function pencocokan(): HasMany
    {
        return $this->hasMany(PencocokanKandidat::class, 'barang_temuan_id');
    }

    public function klaim(): HasMany
    {
        return $this->hasMany(KlaimVerifikasi::class, 'barang_temuan_id');
    }
}
