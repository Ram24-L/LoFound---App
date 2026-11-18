<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class KategoriBarang extends Model
{
    protected $table = 'kategori_barang';

    protected $fillable = ['nama', 'ikon', 'retention_days', 'shippable', 'active'];

    protected function casts(): array
    {
        return [
            'shippable' => 'boolean',
            'active' => 'boolean',
        ];
    }

    public function detailBarangHilang(): HasMany
    {
        return $this->hasMany(DetailBarangHilang::class, 'kategori_id');
    }

    public function barangTemuan(): HasMany
    {
        return $this->hasMany(BarangTemuan::class, 'kategori_id');
    }
}
