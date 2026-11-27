<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bast_pengambilan', function (Blueprint $table) {
            $table->string('midtrans_order_id', 64)->nullable()->unique()->after('kode');
            $table->string('snap_token', 255)->nullable()->after('status_bayar');
            $table->text('payment_url')->nullable()->after('snap_token');
            $table->string('payment_type', 50)->nullable()->after('payment_url');
        });
    }

    public function down(): void
    {
        Schema::table('bast_pengambilan', function (Blueprint $table) {
            $table->dropUnique(['midtrans_order_id']);
            $table->dropColumn([
                'midtrans_order_id',
                'snap_token',
                'payment_url',
                'payment_type',
            ]);
        });
    }
};
