<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bast_pengambilan', function (Blueprint $table) {
            $table->string('biteship_order_id', 120)->nullable()->index()->after('nomor_resi');
            $table->string('biteship_tracking_id', 120)->nullable()->index()->after('biteship_order_id');
            $table->string('courier_company', 40)->nullable()->after('kurir');
            $table->string('courier_type', 40)->nullable()->after('courier_company');
            $table->string('destination_postal_code', 10)->nullable()->after('alamat_kirim');
            $table->string('recipient_name', 120)->nullable()->after('destination_postal_code');
            $table->string('recipient_phone', 30)->nullable()->after('recipient_name');
            $table->string('shipping_status', 40)->nullable()->after('biteship_tracking_id');
            $table->json('tracking_history')->nullable()->after('shipping_status');
        });
    }

    public function down(): void
    {
        Schema::table('bast_pengambilan', function (Blueprint $table) {
            $table->dropColumn([
                'biteship_order_id',
                'biteship_tracking_id',
                'courier_company',
                'courier_type',
                'destination_postal_code',
                'recipient_name',
                'recipient_phone',
                'shipping_status',
                'tracking_history',
            ]);
        });
    }
};
