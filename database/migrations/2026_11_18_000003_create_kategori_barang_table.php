<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kategori_barang', function (Blueprint $table) {
            $table->id();
            $table->string('nama');
            $table->string('ikon')->nullable();
            $table->integer('retention_days')->default(30);
            $table->boolean('shippable')->default(true);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kategori_barang');
    }
};
