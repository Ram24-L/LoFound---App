<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected $fillable = [
        'name', 'email', 'phone', 'nik', 'address', 'password', 'role', 'stasiun_id', 'active',
    ];

    protected $hidden = [
        'password', 'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'address'  => 'array',
            'active'   => 'boolean',
        ];
    }

    /* ---------- Relationships ---------- */

    public function stasiun(): BelongsTo
    {
        return $this->belongsTo(Stasiun::class, 'stasiun_id');
    }

    public function laporanBarangHilang(): HasMany
    {
        return $this->hasMany(LaporanBarangHilang::class);
    }

    public function barangTemuanDicatat(): HasMany
    {
        return $this->hasMany(BarangTemuan::class, 'petugas_id');
    }

    /* ---------- Helpers ---------- */

    public function isPenumpang(): bool
    {
        return $this->role === 'penumpang';
    }

    public function isStaff(): bool
    {
        return in_array($this->role, ['cs', 'logistik', 'admin', 'kepala_stasiun', 'debug']);
    }
}
