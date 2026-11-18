<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('laporan_barang_hilang', function (Blueprint $table) {
            $table->id();
            $table->string('kode', 20)->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('stasiun_dari_id')->constrained('stasiun');
            $table->foreignId('stasiun_ke_id')->constrained('stasiun');
            $table->date('tanggal_kejadian');
            $table->string('waktu_kejadian', 10);
            $table->string('posisi_terakhir');
            $table->text('ciri_rahasia');
            $table->string('foto_referensi')->nullable();
            $table->string('status', 20)->default('diterima');
            $table->text('alasan_batal')->nullable();
            $table->boolean('notify')->default(true);
            $table->timestamps();

            $table->index('status');
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('laporan_barang_hilang');
    }
};
