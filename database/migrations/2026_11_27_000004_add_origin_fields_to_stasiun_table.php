<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stasiun', function (Blueprint $table) {
            $table->string('alamat_posko', 255)->nullable()->after('jam_layanan');
            $table->string('kode_pos', 10)->nullable()->after('alamat_posko');
            $table->string('telepon_posko', 30)->nullable()->after('kode_pos');
        });

        $defaults = [
            'BOO'  => ['kode_pos' => '16124', 'telepon_posko' => '081210000101', 'alamat_posko' => 'Posko CS Stasiun Bogor, Jl. Nyi Raja Permas, Cibogor, Bogor Tengah, Kota Bogor'],
            'CTA'  => ['kode_pos' => '16710', 'telepon_posko' => '081210000102', 'alamat_posko' => 'Posko CS Stasiun Cilebut, Cilebut Timur, Sukaraja, Kabupaten Bogor'],
            'DP'   => ['kode_pos' => '16431', 'telepon_posko' => '081210000103', 'alamat_posko' => 'Posko CS Stasiun Depok, Jl. Stasiun Depok Lama, Pancoran Mas, Kota Depok'],
            'UI'   => ['kode_pos' => '16424', 'telepon_posko' => '081210000104', 'alamat_posko' => 'Posko CS Stasiun Universitas Indonesia, Pondok Cina, Beji, Kota Depok'],
            'MRI'  => ['kode_pos' => '12850', 'telepon_posko' => '081210000105', 'alamat_posko' => 'Posko CS Stasiun Manggarai, Jl. Dr. Saharjo No.1, Tebet, Jakarta Selatan'],
            'JAKK' => ['kode_pos' => '11110', 'telepon_posko' => '081210000106', 'alamat_posko' => 'Posko CS Stasiun Jakarta Kota, Jl. Stasiun Kota No.1, Pinangsia, Tamansari, Jakarta Barat'],
            'THB'  => ['kode_pos' => '10250', 'telepon_posko' => '081210000107', 'alamat_posko' => 'Posko CS Stasiun Tanah Abang, Jl. Jatibaru Raya, Cideng, Gambir, Jakarta Pusat'],
            'SUD'  => ['kode_pos' => '10220', 'telepon_posko' => '081210000108', 'alamat_posko' => 'Posko CS Stasiun Sudirman, Jl. Kendal No.1, Dukuh Atas, Menteng, Jakarta Pusat'],
            'BKS'  => ['kode_pos' => '17121', 'telepon_posko' => '081210000109', 'alamat_posko' => 'Posko CS Stasiun Bekasi, Jl. Ir. H. Juanda, Marga Mulya, Bekasi Utara, Kota Bekasi'],
            'TNG'  => ['kode_pos' => '15111', 'telepon_posko' => '081210000110', 'alamat_posko' => 'Posko CS Stasiun Tangerang, Jl. Kisamaun, Sukarasa, Tangerang, Kota Tangerang'],
            'DU'   => ['kode_pos' => '11270', 'telepon_posko' => '081210000111', 'alamat_posko' => 'Posko CS Stasiun Duri, Jl. Duri Utara, Tambora, Jakarta Barat'],
            'SRP'  => ['kode_pos' => '15310', 'telepon_posko' => '081210000112', 'alamat_posko' => 'Posko CS Stasiun Serpong, Jl. Stasiun Serpong, Rawa Buntu, Tangerang Selatan'],
        ];

        foreach ($defaults as $kode => $attrs) {
            DB::table('stasiun')->where('kode', $kode)->update($attrs);
        }
    }

    public function down(): void
    {
        Schema::table('stasiun', function (Blueprint $table) {
            $table->dropColumn(['alamat_posko', 'kode_pos', 'telepon_posko']);
        });
    }
};
