<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('detail_barang_hilang', function (Blueprint $table) {
            $table->id();
            $table->foreignId('laporan_id')->constrained('laporan_barang_hilang')->cascadeOnDelete();
            $table->string('sub_kode', 5);
            $table->foreignId('kategori_id')->constrained('kategori_barang');
            $table->string('nama_barang');
            $table->string('warna', 30);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('detail_barang_hilang');
    }
};
