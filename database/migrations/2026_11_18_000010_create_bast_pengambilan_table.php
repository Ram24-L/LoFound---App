<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bast_pengambilan', function (Blueprint $table) {
            $table->id();
            $table->string('kode', 20)->unique();
            $table->foreignId('klaim_id')->constrained('klaim_verifikasi')->cascadeOnDelete();
            $table->text('kode_qr')->nullable();
            $table->string('metode_ambil', 20)->default('stasiun');
            $table->foreignId('stasiun_ambil_id')->nullable()->constrained('stasiun')->nullOnDelete();
            $table->text('alamat_kirim')->nullable();
            $table->string('kurir', 50)->nullable();
            $table->integer('ongkir')->nullable();
            $table->string('status_bayar', 20)->nullable();
            $table->string('nomor_resi', 50)->nullable();
            $table->timestamp('waktu_serah_terima')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bast_pengambilan');
    }
};
