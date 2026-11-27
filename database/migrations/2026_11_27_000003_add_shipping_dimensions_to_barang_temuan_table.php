<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('barang_temuan', function (Blueprint $table) {
            $table->unsignedInteger('berat_gram')->default(1000)->after('expires_in');
            $table->unsignedInteger('panjang_cm')->nullable()->after('berat_gram');
            $table->unsignedInteger('lebar_cm')->nullable()->after('panjang_cm');
            $table->unsignedInteger('tinggi_cm')->nullable()->after('lebar_cm');
            $table->unsignedInteger('estimasi_nilai')->default(250000)->after('tinggi_cm');
        });
    }

    public function down(): void
    {
        Schema::table('barang_temuan', function (Blueprint $table) {
            $table->dropColumn([
                'berat_gram',
                'panjang_cm',
                'lebar_cm',
                'tinggi_cm',
                'estimasi_nilai',
            ]);
        });
    }
};
