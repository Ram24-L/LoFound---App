<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LaporanBarangHilang extends Model
{
    protected $table = 'laporan_barang_hilang';

    protected $fillable = [
        'kode', 'user_id', 'stasiun_dari_id', 'stasiun_ke_id',
        'tanggal_kejadian', 'waktu_kejadian', 'posisi_terakhir',
        'ciri_rahasia', 'foto_referensi', 'status', 'alasan_batal', 'notify',
    ];

    protected function casts(): array
    {
        return [
            'tanggal_kejadian' => 'date',
            'notify' => 'boolean',
        ];
    }

    /* ---------- Relationships ---------- */

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function stasiunDari(): BelongsTo
    {
        return $this->belongsTo(Stasiun::class, 'stasiun_dari_id');
    }

    public function stasiunKe(): BelongsTo
    {
        return $this->belongsTo(Stasiun::class, 'stasiun_ke_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(DetailBarangHilang::class, 'laporan_id')->orderBy('sub_kode');
    }

    public function detailBarang(): HasMany
    {
        return $this->items();
    }

    public function riwayat(): HasMany
    {
        return $this->hasMany(RiwayatLaporan::class, 'laporan_id');
    }

    public function pencocokan(): HasMany
    {
        return $this->hasMany(PencocokanKandidat::class, 'laporan_id');
    }

    public function klaim(): HasMany
    {
        return $this->hasMany(KlaimVerifikasi::class, 'laporan_id');
    }

    /* ---------- Helpers ---------- */

    /**
     * Generate the next report code like LPR-2026-044.
     */
    public static function generateKode(): string
    {
        $year = now()->year;
        $last = static::where('kode', 'like', "LPR-{$year}-%")
            ->orderByDesc('kode')
            ->value('kode');

        if ($last) {
            $seq = (int) substr($last, -3) + 1;
        } else {
            $seq = 1;
        }

        return sprintf('LPR-%d-%03d', $year, $seq);
    }

    /**
     * Map this model to the front-end Report shape.
     */
    public function toReportArray(): array
    {
        $this->loadMissing(['items.kategori', 'riwayat', 'stasiunDari', 'stasiunKe', 'pencocokan.barangTemuan', 'klaim.barangTemuan']);

        $latestKlaim = $this->klaim->sortByDesc('id')->first();
        $latestBast  = $latestKlaim ? BastPengambilan::where('klaim_id', $latestKlaim->id)->latest()->first() : null;
        $foundItem   = $latestKlaim?->barangTemuan ?? $this->pencocokan->first()?->barangTemuan;

        return [
            'id'         => $this->kode,
            'items'      => $this->items->map(fn ($item) => [
                'sub'      => $item->sub_kode,
                'name'     => $item->nama_barang,
                'category' => $item->kategori->nama,
                'color'    => $item->warna,
            ])->values()->toArray(),
            'from'       => $this->stasiunDari->nama,
            'to'         => $this->stasiunKe->nama,
            'date'       => $this->tanggal_kejadian->translatedFormat('j M Y'),
            'time'       => $this->waktu_kejadian,
            'position'   => $this->posisi_terakhir,
            'secret'     => $this->ciri_rahasia,
            'photo'      => $this->foto_referensi,
            'status'     => $this->status,
            'candidates' => $this->pencocokan->count(),
            'notify'     => $this->notify,
            'history'    => $this->riwayat->map(fn ($r) => [
                't'    => $r->waktu,
                'text' => $r->keterangan,
            ])->values()->toArray(),
            'updated'    => $this->riwayat->last()?->waktu ?? $this->waktu_kejadian,
            'attempts'   => $this->klaim->count() ?: null,
            'bastCode'        => $latestBast?->kode,
            'qrCode'          => $latestBast?->kode_qr ?? $latestBast?->kode,
            'awb'             => $latestBast?->nomor_resi,
            'paymentStatus'   => $latestBast?->status_bayar,
            'paymentOrderId'  => $latestBast?->midtrans_order_id ?? $latestBast?->kode,
            'snapToken'       => $latestBast?->snap_token,
            'paymentUrl'      => $latestBast?->payment_url,
            'paymentType'     => $latestBast?->payment_type,
            'shippingCourier'    => $latestBast?->kurir,
            'courierCompany'     => $latestBast?->courier_company,
            'courierType'        => $latestBast?->courier_type,
            'shippingAmount'     => $latestBast?->ongkir,
            'shippingAddress'    => $latestBast?->alamat_kirim,
            'shippingStatus'     => $latestBast?->shipping_status,
            'biteshipOrderId'    => $latestBast?->biteship_order_id,
            'biteshipTrackingId' => $latestBast?->biteship_tracking_id,
            'trackingHistory'    => $latestBast?->tracking_history ?? [],
            'packageWeightGrams' => $foundItem ? (int) ($foundItem->berat_gram ?? 1000) : null,
            'packageLengthCm'    => $foundItem?->panjang_cm ? (int) $foundItem->panjang_cm : null,
            'packageWidthCm'     => $foundItem?->lebar_cm ? (int) $foundItem->lebar_cm : null,
            'packageHeightCm'    => $foundItem?->tinggi_cm ? (int) $foundItem->tinggi_cm : null,
            'packageValue'       => $foundItem ? (int) ($foundItem->estimasi_nilai ?? 250000) : null,
        ];
    }
}
