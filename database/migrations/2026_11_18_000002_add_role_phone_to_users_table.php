<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone', 20)->nullable()->after('email');
            $table->string('role', 20)->default('penumpang')->after('phone');
            $table->foreignId('stasiun_id')->nullable()->after('role')->constrained('stasiun')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['stasiun_id']);
            $table->dropColumn(['phone', 'role', 'stasiun_id']);
        });
    }
};
