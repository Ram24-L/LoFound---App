<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('barang_temuan', function (Blueprint $table) {
            $table->id();
            $table->string('kode', 20)->unique();
            $table->foreignId('petugas_id')->constrained('users');
            $table->foreignId('stasiun_temuan_id')->constrained('stasiun');
            $table->foreignId('kategori_id')->constrained('kategori_barang');
            $table->string('nama_barang');
            $table->string('warna', 30);
            $table->string('lokasi_spesifik')->nullable();
            $table->date('tanggal_temuan');
            $table->string('waktu_temuan', 10)->nullable();
            $table->string('foto_barang')->nullable();
            $table->text('ciri_kunci')->nullable();
            $table->string('status_simpan', 20)->default('Tersimpan');
            $table->integer('expires_in')->default(30);
            $table->json('secret')->nullable();
            $table->timestamps();

            $table->index('status_simpan');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('barang_temuan');
    }
};
