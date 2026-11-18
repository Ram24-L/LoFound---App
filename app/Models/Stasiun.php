<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Stasiun extends Model
{
    protected $table = 'stasiun';

    protected $fillable = ['kode', 'nama', 'lin', 'jam_layanan', 'active'];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'stasiun_id');
    }

    public function laporanDari(): HasMany
    {
        return $this->hasMany(LaporanBarangHilang::class, 'stasiun_dari_id');
    }

    public function laporanKe(): HasMany
    {
        return $this->hasMany(LaporanBarangHilang::class, 'stasiun_ke_id');
    }

    public function barangTemuan(): HasMany
    {
        return $this->hasMany(BarangTemuan::class, 'stasiun_temuan_id');
    }
}
