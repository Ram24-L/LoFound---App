<?php

namespace App\Http\Controllers\Api;

use App\Models\BastPengambilan;
use App\Models\LaporanBarangHilang;
use Illuminate\Http\JsonResponse;

class HomeController
{
    public function stats(): JsonResponse
    {
        $totalLaporan = LaporanBarangHilang::count();
        $selesai      = LaporanBarangHilang::where('status', 'selesai')->count();
        $dalamProses  = LaporanBarangHilang::whereNotIn('status', ['selesai', 'dibatalkan', 'kedaluwarsa'])->count();

        $rasio = $totalLaporan > 0 ? round(($selesai / $totalLaporan) * 100, 1) : 0;

        return response()->json([
            'total'       => $totalLaporan,
            'returned'    => $selesai,
            'ratio'       => $rasio,
            'in_progress' => $dalamProses,
            'feed'        => $this->getFeedItems(),
        ]);
    }

    public function feed(): JsonResponse
    {
        return response()->json($this->getFeedItems());
    }

    private function getFeedItems()
    {
        // Get completed reports with masked owner names for transparency feed
        return LaporanBarangHilang::where('status', 'selesai')
            ->with(['items.kategori', 'stasiunDari', 'stasiunKe', 'user', 'klaim.bast'])
            ->latest('updated_at')
            ->take(10)
            ->get()
            ->map(function ($lap) {
                $item = $lap->items->first();
                $name = $lap->user->name;
                // Mask name: "M. Ramdhan Maulana" → "Sdr. M***"
                $parts   = explode(' ', $name);
                $initial = mb_substr($parts[0], 0, 1);
                $masked  = (count($parts) > 1 ? 'Sdr. ' : '') . $initial . '***';
                $bastCode = $lap->klaim->sortByDesc('id')->first()?->bast?->kode ?? $lap->kode;

                return [
                    'id'   => $lap->kode,
                    'cat'  => $item?->kategori?->nama ?? 'Lainnya',
                    'item' => $item?->nama_barang ?? '-',
                    'from' => $lap->stasiunDari->nama,
                    'to'   => $lap->stasiunKe->nama,
                    'who'  => $masked,
                    'bast' => $bastCode,
                    'when' => $lap->updated_at->locale('id')->diffForHumans(),
                    'line' => $lap->stasiunDari->lin,
                ];
            })
            ->values();
    }
}
