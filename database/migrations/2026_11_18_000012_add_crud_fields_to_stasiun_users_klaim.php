<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stasiun', function (Blueprint $table) {
            if (! Schema::hasColumn('stasiun', 'jam_layanan')) {
                $table->string('jam_layanan', 30)->default('04:00–24:00')->after('lin');
            }
            if (! Schema::hasColumn('stasiun', 'active')) {
                $table->boolean('active')->default(true)->after('jam_layanan');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'nik')) {
                $table->string('nik', 20)->nullable()->after('phone');
            }
            if (! Schema::hasColumn('users', 'address')) {
                $table->json('address')->nullable()->after('nik');
            }
            if (! Schema::hasColumn('users', 'active')) {
                $table->boolean('active')->default(true)->after('stasiun_id');
            }
        });

        Schema::table('klaim_verifikasi', function (Blueprint $table) {
            if (! Schema::hasColumn('klaim_verifikasi', 'nik')) {
                $table->string('nik', 20)->nullable()->after('jawaban_rahasia');
            }
        });
    }

    public function down(): void
    {
        Schema::table('stasiun', function (Blueprint $table) {
            $table->dropColumn(['jam_layanan', 'active']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['nik', 'address', 'active']);
        });
        Schema::table('klaim_verifikasi', function (Blueprint $table) {
            $table->dropColumn(['nik']);
        });
    }
};
