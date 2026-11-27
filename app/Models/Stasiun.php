<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Stasiun extends Model
{
    protected $table = 'stasiun';

    protected $fillable = [
        'kode', 'nama', 'lin', 'jam_layanan',
        'alamat_posko', 'kode_pos', 'telepon_posko', 'active',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
        ];
    }

    /**
     * Normalized Biteship origin & posko metadata for multi-station dispatch.
     *
     * @return array{
     *   station_id: int,
     *   station_code: string,
     *   station_name: string,
     *   postal_code: int,
     *   address: string,
     *   contact_name: string,
     *   contact_phone: string,
     *   hours: string
     * }
     */
    public function originSpecs(): array
    {
        $cleanPostal = preg_replace('/\D+/', '', (string) $this->kode_pos) ?? '';
        $postal = strlen($cleanPostal) === 5
            ? (int) $cleanPostal
            : (int) config('services.biteship.origin_postal_code', 11110);

        return [
            'station_id'    => (int) $this->id,
            'station_code'  => (string) $this->kode,
            'station_name'  => (string) $this->nama,
            'postal_code'   => $postal,
            'address'       => $this->alamat_posko ?: "Posko CS Stasiun {$this->nama}",
            'contact_name'  => "Posko CS Stasiun {$this->nama} (LoFound)",
            'contact_phone' => $this->telepon_posko ?: (string) config('services.biteship.origin_phone', '081212345678'),
            'hours'         => $this->jam_layanan ?: '04:00–24:00',
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
