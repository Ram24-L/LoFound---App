<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('klaim_verifikasi', function (Blueprint $table) {
            $table->id();
            $table->string('kode', 20)->unique();
            $table->foreignId('laporan_id')->constrained('laporan_barang_hilang')->cascadeOnDelete();
            $table->foreignId('barang_temuan_id')->constrained('barang_temuan');
            $table->text('jawaban_rahasia');
            $table->string('bukti_tambahan')->nullable();
            $table->string('status_verifikasi', 20)->default('menunggu');
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('catatan_cs')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('klaim_verifikasi');
    }
};
