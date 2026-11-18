<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pencocokan_kandidat', function (Blueprint $table) {
            $table->id();
            $table->foreignId('laporan_id')->constrained('laporan_barang_hilang')->cascadeOnDelete();
            $table->foreignId('barang_temuan_id')->constrained('barang_temuan')->cascadeOnDelete();
            $table->integer('skor_kecocokan')->default(0);
            $table->string('status_cocok', 20)->default('pending');
            $table->timestamps();

            $table->unique(['laporan_id', 'barang_temuan_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pencocokan_kandidat');
    }
};
