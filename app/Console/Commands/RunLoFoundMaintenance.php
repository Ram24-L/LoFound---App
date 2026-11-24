<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\BarangTemuan;
use App\Models\KlaimVerifikasi;
use App\Models\LaporanBarangHilang;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class RunLoFoundMaintenance extends Command
{
    protected $signature = 'lofound:maintenance {--force-ktp : Delete KTP files immediately on completed reports without 24h wait}';

    protected $description = 'Run UU PDP KTP auto-cleanup and item retention/expiry maintenance';

    public function handle(): int
    {
        $cutoff = $this->option('force-ktp') ? now() : now()->subHours(24);

        // 1. UU PDP KTP Auto-Cleanup for completed reports
        $claimsWithKtp = KlaimVerifikasi::with('laporan')
            ->whereNotNull('bukti_tambahan')
            ->whereHas('laporan', fn ($q) => $q->where('status', 'selesai')->where('updated_at', '<=', $cutoff))
            ->get();

        $deletedKtp = 0;
        foreach ($claimsWithKtp as $claim) {
            $path = (string) $claim->bukti_tambahan;
            if (str_starts_with($path, '/api/private-files/ktp/')) {
                $file = basename($path);
                Storage::disk('local')->delete('ktp/' . $file);
            } elseif (str_starts_with($path, '/storage/')) {
                $rel = str_replace('/storage/', '', $path);
                Storage::disk('public')->delete($rel);
            }

            $claim->update(['bukti_tambahan' => null]);
            $deletedKtp++;
        }

        if ($deletedKtp > 0) {
            AuditLog::record(null, 'Sistem (UU PDP)', 'Auto-hapus foto KTP selesai', "{$deletedKtp} file dihapus");
        }

        // 2. Archive expired warehouse items (expires_in <= 0)
        $archived = BarangTemuan::where('status_simpan', 'Tersimpan')
            ->where('expires_in', '<=', 0)
            ->update(['status_simpan' => 'Diarsipkan']);

        // 3. Decrement remaining retention days for items not updated today
        BarangTemuan::where('status_simpan', 'Tersimpan')
            ->where('expires_in', '>', 0)
            ->whereDate('updated_at', '<', today())
            ->decrement('expires_in');

        // 4. Mark stale unresolved reports (> 90 days old) as kedaluwarsa
        $expiredReports = LaporanBarangHilang::whereIn('status', ['diterima', 'pencarian'])
            ->where('created_at', '<', now()->subDays(90))
            ->update(['status' => 'kedaluwarsa']);

        $this->info("Maintenance complete: {$deletedKtp} KTP cleaned, {$archived} items archived, {$expiredReports} reports expired.");

        return self::SUCCESS;
    }
}
