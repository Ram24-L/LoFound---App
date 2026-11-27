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
        'expires_in', 'berat_gram', 'panjang_cm', 'lebar_cm', 'tinggi_cm',
        'estimasi_nilai', 'secret',
    ];

    protected function casts(): array
    {
        return [
            'tanggal_temuan' => 'date',
            'berat_gram'     => 'integer',
            'panjang_cm'     => 'integer',
            'lebar_cm'       => 'integer',
            'tinggi_cm'      => 'integer',
            'estimasi_nilai' => 'integer',
            'secret'         => 'array',
        ];
    }

    /**
     * Normalize shipping weight, volumetric dimensions, and insured value.
     *
     * @return array{
     *   weight_grams: int,
     *   length_cm: int|null,
     *   width_cm: int|null,
     *   height_cm: int|null,
     *   estimated_value: int,
     *   volumetric_grams: int|null,
     *   chargeable_grams: int
     * }
     */
    public function shippingSpecs(): array
    {
        $weightGrams = max(50, (int) ($this->berat_gram ?: 1000));
        $lengthCm = $this->panjang_cm ? max(1, (int) $this->panjang_cm) : null;
        $widthCm = $this->lebar_cm ? max(1, (int) $this->lebar_cm) : null;
        $heightCm = $this->tinggi_cm ? max(1, (int) $this->tinggi_cm) : null;
        $estimatedValue = max(1000, (int) ($this->estimasi_nilai ?: 250000));

        $volumetricGrams = ($lengthCm && $widthCm && $heightCm)
            ? (int) ceil((($lengthCm * $widthCm * $heightCm) / 6000) * 1000)
            : null;

        return [
            'weight_grams'     => $weightGrams,
            'length_cm'        => $lengthCm,
            'width_cm'         => $widthCm,
            'height_cm'        => $heightCm,
            'estimated_value'  => $estimatedValue,
            'volumetric_grams' => $volumetricGrams,
            'chargeable_grams' => max($weightGrams, $volumetricGrams ?? 0),
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
