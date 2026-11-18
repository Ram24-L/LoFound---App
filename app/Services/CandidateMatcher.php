<?php

namespace App\Services;

use App\Models\BarangTemuan;
use App\Models\DetailBarangHilang;
use App\Models\LaporanBarangHilang;

class CandidateMatcher
{
    private const GROUPS = [
        'laptop'   => ['laptop', 'macbook', 'thinkpad', 'zenbook', 'notebook', 'vivobook', 'ideapad'],
        'audio'    => ['headphone', 'earphone', 'tws', 'airpods', 'headset', 'buds', 'wh-1000', 'earcup'],
        'tablet'   => ['ipad', 'tablet', 'galaxy tab', 'matepad'],
        'phone'    => ['iphone', 'samsung', 'ponsel', 'handphone', 'smartphone', 'xiaomi', 'redmi', 'oppo', 'vivo', 'pixel'],
        'console'  => ['nintendo', 'switch', 'playstation', 'steam deck', 'konsol', 'joy-con'],
        'camera'   => ['kamera', 'camera', 'fujifilm', 'canon', 'sony alpha', 'nikon', 'gopro', 'lensa'],
        'wallet'   => ['dompet', 'wallet', 'cardholder', 'kartu multi trip', 'kmt'],
        'bag'      => ['tas', 'ransel', 'backpack', 'totebag', 'slingbag', 'pouch', 'koper', 'eiger'],
        'umbrella' => ['payung', 'umbrella', 'fibrella'],
        'bottle'   => ['botol', 'tumbler', 'corkcicle', 'termos', 'minum'],
        'glasses'  => ['kacamata', 'glasses', 'sunglasses'],
        'jacket'   => ['jaket', 'hoodie', 'sweater', 'cardigan', 'rompi', 'denim'],
        'watch'    => ['jam tangan', 'smartwatch', 'garmin', 'apple watch'],
        'key'      => ['kunci', 'keychain', 'gantungan kunci', 'stnk'],
    ];

    private const STOP_WORDS = [
        'dan', 'di', 'ke', 'dari', 'yang', 'ada', 'dengan', 'untuk', 'pada',
        'warna', 'hitam', 'putih', 'silver', 'biru', 'merah', 'coklat', 'hijau',
        'kuning', 'abu', 'abu-abu', 'gerbong', 'rak', 'atas', 'kursi', 'stasiun',
        'posko', 'barang', 'milik', 'saya', 'ukuran', 'kecil', 'besar',
    ];

    public static function score(LaporanBarangHilang $laporan, BarangTemuan $bt): int
    {
        $laporan->loadMissing(['items', 'stasiunDari', 'stasiunKe']);
        $bt->loadMissing(['stasiunTemuan']);

        $bestScore = 0;

        foreach ($laporan->items as $item) {
            $s = self::scoreItem($laporan, $item, $bt);
            if ($s > $bestScore) {
                $bestScore = $s;
            }
        }

        return $bestScore;
    }

    private static function scoreItem(LaporanBarangHilang $laporan, DetailBarangHilang $item, BarangTemuan $bt): int
    {
        // 1. Category must match
        if ((int) $item->kategori_id !== (int) $bt->kategori_id) {
            return 0;
        }

        $reportText = mb_strtolower($item->nama_barang . ' ' . ($laporan->ciri_rahasia ?? ''));
        $foundDetail = is_array($bt->secret) ? (($bt->secret['detail'] ?? '') . ' ' . ($bt->secret['notes'] ?? '')) : '';
        $foundText = mb_strtolower($bt->nama_barang . ' ' . $foundDetail);

        // 2. Object sub-type group check
        $reportGroup = self::detectGroup($item->nama_barang);
        $foundGroup = self::detectGroup($bt->nama_barang . ' ' . ($bt->secret['detail'] ?? ''));

        if ($reportGroup && $foundGroup && $reportGroup !== $foundGroup) {
            // Different item types within the same category (e.g. Laptop vs Headphone vs iPad)
            return 0;
        }

        $score = 30; // Base score for matching category without sub-type conflict

        if ($reportGroup && $foundGroup && $reportGroup === $foundGroup) {
            $score += 30;
        }

        // 3. Keyword overlap
        $reportWords = self::extractKeywords($reportText);
        $foundWords = self::extractKeywords($foundText);
        $common = array_intersect($reportWords, $foundWords);
        $score += min(25, count($common) * 10);

        // 4. Color match
        if ($item->warna && $bt->warna && mb_strtolower(trim($item->warna)) === mb_strtolower(trim($bt->warna))) {
            $score += 15;
        }

        // 5. Station / Route match
        if ($bt->stasiun_temuan_id === $laporan->stasiun_ke_id || $bt->stasiun_temuan_id === $laporan->stasiun_dari_id) {
            $score += 15;
        } elseif (
            $bt->stasiunTemuan?->lin &&
            ($bt->stasiunTemuan->lin === $laporan->stasiunKe?->lin || $bt->stasiunTemuan->lin === $laporan->stasiunDari?->lin)
        ) {
            $score += 8;
        }

        return min(100, $score);
    }

    private static function detectGroup(string $text): ?string
    {
        $lower = mb_strtolower($text);
        foreach (self::GROUPS as $group => $keywords) {
            foreach ($keywords as $kw) {
                if (str_contains($lower, $kw)) {
                    return $group;
                }
            }
        }

        return null;
    }

    private static function extractKeywords(string $text): array
    {
        $words = preg_split('/[^a-z0-9]+/i', mb_strtolower($text)) ?: [];

        return array_values(array_unique(array_filter($words, function ($w) {
            return strlen($w) >= 3 && ! in_array($w, self::STOP_WORDS, true);
        })));
    }
}
