<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\BarangTemuan;
use App\Models\BastPengambilan;
use App\Models\DetailBarangHilang;
use App\Models\KategoriBarang;
use App\Models\KlaimVerifikasi;
use App\Models\LaporanBarangHilang;
use App\Models\PencocokanKandidat;
use App\Models\RiwayatLaporan;
use App\Models\Stasiun;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        /* ============================================================
         * 1. Stasiun KRL
         * ============================================================ */
        $stations = [
            ['kode' => 'BOO',  'nama' => 'Bogor',                  'lin' => 'Lin Bogor'],
            ['kode' => 'CTA',  'nama' => 'Cilebut',                'lin' => 'Lin Bogor'],
            ['kode' => 'DP',   'nama' => 'Depok',                  'lin' => 'Lin Bogor'],
            ['kode' => 'UI',   'nama' => 'Universitas Indonesia',  'lin' => 'Lin Bogor'],
            ['kode' => 'MRI',  'nama' => 'Manggarai',              'lin' => 'Lin Bogor'],
            ['kode' => 'JAKK', 'nama' => 'Jakarta Kota',           'lin' => 'Lin Bogor'],
            ['kode' => 'THB',  'nama' => 'Tanah Abang',            'lin' => 'Lin Rangkasbitung'],
            ['kode' => 'SUD',  'nama' => 'Sudirman',               'lin' => 'Lin Cikarang'],
            ['kode' => 'BKS',  'nama' => 'Bekasi',                 'lin' => 'Lin Cikarang'],
            ['kode' => 'TNG',  'nama' => 'Tangerang',              'lin' => 'Lin Tangerang'],
            ['kode' => 'DU',   'nama' => 'Duri',                   'lin' => 'Lin Tangerang'],
            ['kode' => 'SRP',  'nama' => 'Serpong',                'lin' => 'Lin Rangkasbitung'],
        ];

        $stasiunMap = [];
        foreach ($stations as $s) {
            $st = Stasiun::create($s);
            $stasiunMap[$st->nama] = $st->id;
        }

        /* ============================================================
         * 2. Kategori Barang
         * ============================================================ */
        $categories = [
            ['nama' => 'Elektronik',     'ikon' => 'laptop',    'retention_days' => 30, 'shippable' => true],
            ['nama' => 'Non Elektronik', 'ikon' => 'package',   'retention_days' => 30, 'shippable' => true],
            ['nama' => 'Uang Tunai',     'ikon' => 'banknote',  'retention_days' => 90, 'shippable' => false],
        ];

        $catMap = [];
        foreach ($categories as $c) {
            $cat = KategoriBarang::create($c);
            $catMap[$cat->nama] = $cat->id;
        }

        /* ============================================================
         * 3. User Accounts
         * ============================================================ */
        $password = Hash::make('password');

        // Penumpang utama (matches the prototype user "Ramdhan")
        $penumpang = User::create([
            'name'     => 'M. Ramdhan Maulana',
            'email'    => 'ramdhan@mail.com',
            'phone'    => '081234567890',
            'password' => $password,
            'role'     => 'penumpang',
        ]);

        // Staff users (from STAFF_USERS in data.ts + role-based emails)
        $staffData = [
            ['name' => 'Rina Kurniasih',  'email' => 'rina.k@kci.id',          'role' => 'cs',              'station' => 'Jakarta Kota'],
            ['name' => 'Rina Kurniasih',  'email' => 'petugascs@kci.id',       'role' => 'cs',              'station' => 'Jakarta Kota'],
            ['name' => 'Dewi Lestari',    'email' => 'dewi.l@kci.id',          'role' => 'cs',              'station' => 'Jakarta Kota'],
            ['name' => 'Budi Santoso',    'email' => 'budi.s@kci.id',          'role' => 'cs',              'station' => 'Manggarai'],
            ['name' => 'Agus Pratama',    'email' => 'agus.p@kci.id',          'role' => 'logistik',        'station' => 'Jakarta Kota'],
            ['name' => 'Agus Pratama',    'email' => 'petugaslogistik@kci.id', 'role' => 'logistik',        'station' => 'Jakarta Kota'],
            ['name' => 'Hendra Wijaya',   'email' => 'hendra.w@kci.id',        'role' => 'admin',           'station' => null],
            ['name' => 'Hendra Wijaya',   'email' => 'admin@kci.id',           'role' => 'admin',           'station' => null],
            ['name' => 'Hendra Wijaya',   'email' => 'petugasadmin@kci.id',    'role' => 'admin',           'station' => null],
            ['name' => 'Ir. Sutrisno',    'email' => 'sutrisno@kci.id',        'role' => 'kepala_stasiun',  'station' => 'Jakarta Kota'],
            ['name' => 'Ir. Sutrisno',    'email' => 'kepalastasiun@kci.id',   'role' => 'kepala_stasiun',  'station' => 'Jakarta Kota'],
            ['name' => 'Super Debug',     'email' => 'debug@kci.id',           'role' => 'debug',           'station' => 'Jakarta Kota'],
            ['name' => 'Maya Sari',       'email' => 'maya.s@kci.id',          'role' => 'cs',              'station' => 'Bogor'],
        ];

        $staffMap = [];
        foreach ($staffData as $sd) {
            $user = User::create([
                'name'       => $sd['name'],
                'email'      => $sd['email'],
                'phone'      => null,
                'password'   => $password,
                'role'       => $sd['role'],
                'stasiun_id' => $sd['station'] ? ($stasiunMap[$sd['station']] ?? null) : null,
            ]);
            $staffMap[$sd['name']] = $user->id;
        }

        /* ============================================================
         * 4. Sample Reports (from INITIAL_REPORTS in data.ts)
         * ============================================================ */

        // --- LPR-2026-042: MacBook + Payung (status: kandidat) ---
        $lpr042 = LaporanBarangHilang::create([
            'kode'             => 'LPR-2026-042',
            'user_id'          => $penumpang->id,
            'stasiun_dari_id'  => $stasiunMap['Bogor'],
            'stasiun_ke_id'    => $stasiunMap['Manggarai'],
            'tanggal_kejadian' => '2026-11-02',
            'waktu_kejadian'   => '10:15',
            'posisi_terakhir'  => 'Gerbong 4 - Rak Atas',
            'ciri_rahasia'     => 'Stiker NASA di pojok kanan bawah, wallpaper foto kucing oranye, nomor seri berakhiran ...7QX2',
            'foto_referensi'   => 'referensi_macbook.jpg',
            'status'           => 'kandidat',
            'notify'           => true,
        ]);

        DetailBarangHilang::create([
            'laporan_id'  => $lpr042->id,
            'sub_kode'    => 'A',
            'kategori_id' => $catMap['Elektronik'],
            'nama_barang' => 'MacBook Air M2 Silver + Sleeve Hitam',
            'warna'       => 'Silver',
        ]);

        DetailBarangHilang::create([
            'laporan_id'  => $lpr042->id,
            'sub_kode'    => 'B',
            'kategori_id' => $catMap['Non Elektronik'],
            'nama_barang' => 'Payung Lipat Hitam',
            'warna'       => 'Hitam',
        ]);

        RiwayatLaporan::create(['laporan_id' => $lpr042->id, 'waktu' => '10:15', 'keterangan' => 'Dibuat']);
        RiwayatLaporan::create(['laporan_id' => $lpr042->id, 'waktu' => '11:02', 'keterangan' => 'Diubah: warna']);
        RiwayatLaporan::create(['laporan_id' => $lpr042->id, 'waktu' => '13:45', 'keterangan' => 'Kandidat barang ditemukan']);

        // --- LPR-2026-039: Dompet Kulit Coklat (status: pencarian) ---
        $lpr039 = LaporanBarangHilang::create([
            'kode'             => 'LPR-2026-039',
            'user_id'          => $penumpang->id,
            'stasiun_dari_id'  => $stasiunMap['Depok'],
            'stasiun_ke_id'    => $stasiunMap['Tanah Abang'],
            'tanggal_kejadian' => '2026-10-30',
            'waktu_kejadian'   => '07:40',
            'posisi_terakhir'  => 'Gerbong 2 - Kursi Prioritas',
            'ciri_rahasia'     => 'Ada foto keluarga dan kartu perpustakaan atas nama saya',
            'status'           => 'pencarian',
            'notify'           => true,
        ]);

        DetailBarangHilang::create([
            'laporan_id'  => $lpr039->id,
            'sub_kode'    => 'A',
            'kategori_id' => $catMap['Non Elektronik'],
            'nama_barang' => 'Dompet Kulit Coklat + KMT',
            'warna'       => 'Coklat',
        ]);

        RiwayatLaporan::create(['laporan_id' => $lpr039->id, 'waktu' => '07:40', 'keterangan' => 'Dibuat']);

        // --- Completed reports ---
        $completedReports = [
            ['LPR-2026-031', 'Tas Ransel Biru Eiger', 'Non Elektronik', 'Biru', 'Bekasi', 'Sudirman', '2026-10-21'],
            ['LPR-2026-027', 'Earphone TWS Putih', 'Elektronik', 'Putih', 'Depok', 'Manggarai', '2026-10-15'],
            ['LPR-2026-022', 'Payung Merah', 'Non Elektronik', 'Merah', 'Tangerang', 'Duri', '2026-10-09'],
            ['LPR-2026-018', 'Kartu Multi Trip', 'Non Elektronik', 'Biru', 'Bogor', 'Jakarta Kota', '2026-10-02'],
            ['LPR-2026-011', 'Jaket Denim', 'Non Elektronik', 'Biru', 'Serpong', 'Tanah Abang', '2026-09-24'],
        ];

        foreach ($completedReports as [$kode, $nama, $kategori, $warna, $dari, $ke, $tanggal]) {
            $lap = LaporanBarangHilang::create([
                'kode'             => $kode,
                'user_id'          => $penumpang->id,
                'stasiun_dari_id'  => $stasiunMap[$dari],
                'stasiun_ke_id'    => $stasiunMap[$ke],
                'tanggal_kejadian' => $tanggal,
                'waktu_kejadian'   => '08:00',
                'posisi_terakhir'  => 'Gerbong 3',
                'ciri_rahasia'     => 'Ciri rahasia tersimpan',
                'status'           => 'selesai',
                'notify'           => true,
            ]);

            DetailBarangHilang::create([
                'laporan_id'  => $lap->id,
                'sub_kode'    => 'A',
                'kategori_id' => $catMap[$kategori],
                'nama_barang' => $nama,
                'warna'       => $warna,
            ]);

            RiwayatLaporan::create(['laporan_id' => $lap->id, 'waktu' => '08:00', 'keterangan' => 'Dibuat']);
            RiwayatLaporan::create(['laporan_id' => $lap->id, 'waktu' => '15:00', 'keterangan' => 'Serah terima selesai']);
        }

        // --- LPR-2026-015: Cancelled report ---
        $lpr015 = LaporanBarangHilang::create([
            'kode'             => 'LPR-2026-015',
            'user_id'          => $penumpang->id,
            'stasiun_dari_id'  => $stasiunMap['Cilebut'],
            'stasiun_ke_id'    => $stasiunMap['Depok'],
            'tanggal_kejadian' => '2026-09-18',
            'waktu_kejadian'   => '17:20',
            'posisi_terakhir'  => 'Gerbong 6',
            'ciri_rahasia'     => '-',
            'status'           => 'dibatalkan',
            'alasan_batal'     => 'Barang sudah ditemukan sendiri',
            'notify'           => false,
        ]);

        DetailBarangHilang::create([
            'laporan_id'  => $lpr015->id,
            'sub_kode'    => 'A',
            'kategori_id' => $catMap['Non Elektronik'],
            'nama_barang' => 'Botol Minum Tumbler',
            'warna'       => 'Hijau',
        ]);

        RiwayatLaporan::create(['laporan_id' => $lpr015->id, 'waktu' => '17:20', 'keterangan' => 'Dibuat']);
        RiwayatLaporan::create(['laporan_id' => $lpr015->id, 'waktu' => '19:00', 'keterangan' => 'Dibatalkan: Barang sudah ditemukan sendiri']);

        /* ============================================================
         * 5. Barang Temuan (from INVENTORY in data.ts)
         * ============================================================ */
        $rinaId = $staffMap['Rina Kurniasih'];
        $dewiId = $staffMap['Dewi Lestari'];
        $budiId = $staffMap['Budi Santoso'];

        $inventoryData = [
            ['kode' => 'FND-0412', 'petugas' => $dewiId, 'stasiun' => 'Jakarta Kota', 'kat' => 'Elektronik',     'nama' => 'Laptop silver',         'warna' => 'Silver', 'tanggal' => '2026-11-02', 'waktu' => '12:30', 'status' => 'Dalam Klaim',  'expires' => 28, 'secret' => ['detail' => 'MacBook Air M2, stiker NASA pojok kanan bawah, sleeve hitam', 'serial' => 'C02XK1ZJ7QX2', 'locker' => 'Loker B-04', 'notes' => 'Wallpaper foto kucing oranye. Baterai 40%.']],
            ['kode' => 'FND-0409', 'petugas' => $dewiId, 'stasiun' => 'Jakarta Kota', 'kat' => 'Non Elektronik', 'nama' => 'Payung lipat hitam',    'warna' => 'Hitam',  'tanggal' => '2026-11-02', 'waktu' => '12:45', 'status' => 'Tersimpan',    'expires' => 12, 'secret' => ['detail' => 'Payung lipat 3, gagang kayu, merek Fibrella', 'serial' => '-', 'locker' => 'Rak P-11', 'notes' => 'Satu ruas sedikit bengkok.']],
            ['kode' => 'FND-0415', 'petugas' => $budiId, 'stasiun' => 'Manggarai',    'kat' => 'Elektronik',     'nama' => 'Laptop abu-abu',        'warna' => 'Silver', 'tanggal' => '2026-11-02', 'waktu' => '13:10', 'status' => 'Tersimpan',    'expires' => 28, 'secret' => ['detail' => 'Lenovo ThinkPad, stiker kampus', 'serial' => 'PF3AB91', 'locker' => 'Loker A-02', 'notes' => '-']],
            ['kode' => 'FND-0398', 'petugas' => $dewiId, 'stasiun' => 'Jakarta Kota', 'kat' => 'Non Elektronik', 'nama' => 'Dompet coklat',         'warna' => 'Coklat', 'tanggal' => '2026-10-31', 'waktu' => '08:20', 'status' => 'Tersimpan',    'expires' => 3,  'secret' => ['detail' => 'Isi: KTP, 2 kartu ATM, uang Rp 54.000', 'serial' => '-', 'locker' => 'Brankas S-01', 'notes' => 'Uang dihitung 2 petugas.']],
            ['kode' => 'FND-0391', 'petugas' => $dewiId, 'stasiun' => 'Jakarta Kota', 'kat' => 'Non Elektronik', 'nama' => 'Tas ransel hitam',      'warna' => 'Hitam',  'tanggal' => '2026-10-29', 'waktu' => '18:02', 'status' => 'Tersimpan',    'expires' => 2,  'secret' => ['detail' => 'Isi: buku catatan, charger, botol minum', 'serial' => '-', 'locker' => 'Rak T-07', 'notes' => '-']],
            ['kode' => 'FND-0377', 'petugas' => $dewiId, 'stasiun' => 'Jakarta Kota', 'kat' => 'Non Elektronik', 'nama' => 'Jaket hoodie abu',      'warna' => 'Silver', 'tanggal' => '2026-10-27', 'waktu' => '21:15', 'status' => 'Selesai',      'expires' => 20, 'secret' => ['detail' => 'Hoodie Uniqlo ukuran L', 'serial' => '-', 'locker' => '-', 'notes' => 'Diserahkan 30 Okt.']],
            ['kode' => 'FND-0231', 'petugas' => $rinaId, 'stasiun' => 'Jakarta Kota', 'kat' => 'Elektronik',     'nama' => 'Ponsel hitam',          'warna' => 'Hitam',  'tanggal' => '2026-10-10', 'waktu' => '09:40', 'status' => 'Selesai',      'expires' => 0,  'secret' => ['detail' => 'Samsung A54', 'serial' => '356789104455221', 'locker' => '-', 'notes' => '-']],
            ['kode' => 'FND-0416', 'petugas' => $rinaId, 'stasiun' => 'Jakarta Kota', 'kat' => 'Elektronik',     'nama' => 'Powerbank Anker 20000mAh', 'warna' => 'Hitam', 'tanggal' => '2026-11-15', 'waktu' => '09:15', 'status' => 'Tersimpan', 'expires' => 26, 'secret' => ['detail' => 'Kabel type-C terpasang, stiker inisial RK', 'serial' => 'ANK-882190', 'locker' => 'Loker A-03', 'notes' => 'Ditemukan di kursi gerbong 3']],
            ['kode' => 'FND-0417', 'petugas' => $dewiId, 'stasiun' => 'Manggarai',    'kat' => 'Non Elektronik', 'nama' => 'Tumbler Corkcicle Biru',   'warna' => 'Biru',  'tanggal' => '2026-11-15', 'waktu' => '11:20', 'status' => 'Tersimpan', 'expires' => 25, 'secret' => ['detail' => 'Ukuran 16oz, bagian bawah ada karet pelindung', 'serial' => '-', 'locker' => 'Rak B-12', 'notes' => 'Gerbong 5 Lin Bogor']],
            ['kode' => 'FND-0418', 'petugas' => $budiId, 'stasiun' => 'Bogor',        'kat' => 'Elektronik',     'nama' => 'Earphone TWS AirPods Pro', 'warna' => 'Putih', 'tanggal' => '2026-11-16', 'waktu' => '14:05', 'status' => 'Tersimpan', 'expires' => 27, 'secret' => ['detail' => 'Case silikon warna hijau matcha', 'serial' => 'H39K2019LP', 'locker' => 'Loker C-01', 'notes' => 'Peron 2 St. Bogor']],
            ['kode' => 'FND-0419', 'petugas' => $rinaId, 'stasiun' => 'Jakarta Kota', 'kat' => 'Non Elektronik', 'nama' => 'Kacamata Frame Hitam',     'warna' => 'Hitam', 'tanggal' => '2026-11-16', 'waktu' => '16:40', 'status' => 'Tersimpan', 'expires' => 24, 'secret' => ['detail' => 'Merek Owndays beserta hardcase coklat', 'serial' => '-', 'locker' => 'Rak K-04', 'notes' => '-']],
            ['kode' => 'FND-0420', 'petugas' => $budiId, 'stasiun' => 'Depok',        'kat' => 'Non Elektronik', 'nama' => 'Tas Selempang Eiger',      'warna' => 'Hijau', 'tanggal' => '2026-11-16', 'waktu' => '18:10', 'status' => 'Tersimpan', 'expires' => 22, 'secret' => ['detail' => 'Berisi buku catatan kuliah dan pulpen', 'serial' => '-', 'locker' => 'Rak T-02', 'notes' => 'Rak atas gerbong 2']],
            ['kode' => 'FND-0421', 'petugas' => $dewiId, 'stasiun' => 'Tanah Abang',  'kat' => 'Uang Tunai',     'nama' => 'Amplop Coklat Berisi Uang','warna' => 'Coklat','tanggal' => '2026-11-17', 'waktu' => '08:30', 'status' => 'Tersimpan', 'expires' => 85, 'secret' => ['detail' => 'Nominal Rp 350.000 pecahan Rp 50.000 (7 lembar)', 'serial' => '-', 'locker' => 'Brankas S-02', 'notes' => 'Dihitung 2 saksi petugas']],
            ['kode' => 'FND-0422', 'petugas' => $rinaId, 'stasiun' => 'Sudirman',     'kat' => 'Elektronik',     'nama' => 'Smartwatch Garmin Forerunner', 'warna' => 'Hitam', 'tanggal' => '2026-11-17', 'waktu' => '10:00', 'status' => 'Tersimpan', 'expires' => 28, 'secret' => ['detail' => 'Strap nilon hitam, layar terpasang hydrogel', 'serial' => 'GRM-55412', 'locker' => 'Loker A-08', 'notes' => '-']],
            ['kode' => 'FND-0423', 'petugas' => $budiId, 'stasiun' => 'Bekasi',       'kat' => 'Non Elektronik', 'nama' => 'Jaket Kardigan Rajut',     'warna' => 'Merah', 'tanggal' => '2026-11-17', 'waktu' => '13:15', 'status' => 'Tersimpan', 'expires' => 19, 'secret' => ['detail' => 'Ukuran M, kancing kayu', 'serial' => '-', 'locker' => 'Rak P-05', 'notes' => 'Gerbong khusus wanita']],
            ['kode' => 'FND-0424', 'petugas' => $dewiId, 'stasiun' => 'Jakarta Kota', 'kat' => 'Elektronik',     'nama' => 'Tablet Samsung Galaxy Tab','warna' => 'Silver','tanggal' => '2026-11-17', 'waktu' => '15:50', 'status' => 'Tersimpan', 'expires' => 29, 'secret' => ['detail' => 'Termasuk S-Pen warna hitam dan flip cover', 'serial' => 'R52T9011AB', 'locker' => 'Loker B-09', 'notes' => '-']],
            ['kode' => 'FND-0425', 'petugas' => $rinaId, 'stasiun' => 'Manggarai',    'kat' => 'Non Elektronik', 'nama' => 'Dompet Kartu Kulit Biru',  'warna' => 'Biru',  'tanggal' => '2026-11-17', 'waktu' => '19:05', 'status' => 'Tersimpan', 'expires' => 21, 'secret' => ['detail' => 'Berisi KMT, Flazz BCA, dan SIM C', 'serial' => '-', 'locker' => 'Brankas S-04', 'notes' => '-']],
            ['kode' => 'FND-0426', 'petugas' => $budiId, 'stasiun' => 'Tangerang',    'kat' => 'Non Elektronik', 'nama' => 'Payung Panjang Transparan','warna' => 'Putih', 'tanggal' => '2026-11-18', 'waktu' => '07:25', 'status' => 'Tersimpan', 'expires' => 14, 'secret' => ['detail' => 'Gagang plastik putih melengkung', 'serial' => '-', 'locker' => 'Rak P-14', 'notes' => '-']],
            ['kode' => 'FND-0427', 'petugas' => $dewiId, 'stasiun' => 'Jakarta Kota', 'kat' => 'Elektronik',     'nama' => 'Kamera Pocket Canon G7X',  'warna' => 'Hitam', 'tanggal' => '2026-11-18', 'waktu' => '08:40', 'status' => 'Tersimpan', 'expires' => 30, 'secret' => ['detail' => 'SD Card SanDisk 64GB di dalam, wrist strap merah', 'serial' => 'CN-7712901', 'locker' => 'Loker B-01', 'notes' => '-']],
        ];

        $foundItemMap = [];
        foreach ($inventoryData as $inv) {
            $bt = BarangTemuan::create([
                'kode'             => $inv['kode'],
                'petugas_id'       => $inv['petugas'],
                'stasiun_temuan_id'=> $stasiunMap[$inv['stasiun']],
                'kategori_id'      => $catMap[$inv['kat']],
                'nama_barang'      => $inv['nama'],
                'warna'            => $inv['warna'],
                'tanggal_temuan'   => $inv['tanggal'],
                'waktu_temuan'     => $inv['waktu'],
                'status_simpan'    => $inv['status'],
                'expires_in'       => $inv['expires'],
                'secret'           => $inv['secret'],
            ]);
            $foundItemMap[$inv['kode']] = $bt->id;
        }

        /* ============================================================
         * 6. Pencocokan Kandidat (link LPR-2026-042 to found items)
         * ============================================================ */
        PencocokanKandidat::create([
            'laporan_id'      => $lpr042->id,
            'barang_temuan_id'=> $foundItemMap['FND-0412'],
            'skor_kecocokan'  => 95,
            'status_cocok'    => 'pending',
        ]);

        PencocokanKandidat::create([
            'laporan_id'      => $lpr042->id,
            'barang_temuan_id'=> $foundItemMap['FND-0415'],
            'skor_kecocokan'  => 60,
            'status_cocok'    => 'pending',
        ]);

        PencocokanKandidat::create([
            'laporan_id'      => $lpr042->id,
            'barang_temuan_id'=> $foundItemMap['FND-0409'],
            'skor_kecocokan'  => 90,
            'status_cocok'    => 'pending',
        ]);

        /* ============================================================
         * 7. Klaim Verifikasi (from CLAIMS in data.ts)
         * ============================================================ */
        $klm118 = KlaimVerifikasi::create([
            'kode'              => 'KLM-2026-118',
            'laporan_id'        => $lpr042->id,
            'barang_temuan_id'  => $foundItemMap['FND-0412'],
            'jawaban_rahasia'   => 'Ada stiker NASA di pojok kanan bawah, wallpaper foto kucing oranye, nomor seri berakhiran 7QX2. Sleeve hitam berisi charger.',
            'status_verifikasi' => 'menunggu',
            'catatan_cs'        => null,
        ]);

        $klm115 = KlaimVerifikasi::create([
            'kode'              => 'KLM-2026-115',
            'laporan_id'        => $lpr039->id,
            'barang_temuan_id'  => $foundItemMap['FND-0409'],
            'jawaban_rahasia'   => 'Gagang kayu, merek Fibrella, ada sedikit bengkok di ruas ketiga.',
            'status_verifikasi' => 'menunggu',
            'catatan_cs'        => null,
        ]);

        /* ============================================================
         * 8. BAST Pengambilan & Ekspedisi (from SHIPMENTS in data.ts)
         * ============================================================ */
        // BAST Stasiun (KLM-115 / LPR-043 already approved as sample)
        BastPengambilan::create([
            'kode'             => 'KCI-2026-089',
            'klaim_id'         => $klm115->id,
            'kode_qr'          => 'QR-BAST-089-7QX2',
            'metode_ambil'     => 'stasiun',
            'stasiun_ambil_id' => $stasiunMap['Jakarta Kota'],
        ]);

        // Expedition shipments (metode_ambil = 'ekspedisi')
        BastPengambilan::create([
            'kode'             => 'KCI-2026-042',
            'klaim_id'         => $klm118->id,
            'kode_qr'          => 'QR-BAST-EXP-042',
            'metode_ambil'     => 'ekspedisi',
            'alamat_kirim'     => 'Bogor Tengah, Bogor',
            'kurir'            => 'KAI Logistik Express',
            'ongkir'           => 18000,
            'status_bayar'     => 'paid',
            'nomor_resi'       => null, // Menunggu Resi
        ]);

        /* ============================================================
         * 10. 100 Dummy Returned Reports (High Return Rate Metric)
         * ============================================================ */
        $dummyUsers = [
            User::firstOrCreate(['email' => 'ahmad.f@mail.com'], ['name' => 'Ahmad Fauzi', 'phone' => '081310000001', 'password' => $password, 'role' => 'penumpang']),
            User::firstOrCreate(['email' => 'siti.a@mail.com'], ['name' => 'Siti Aminah', 'phone' => '081310000002', 'password' => $password, 'role' => 'penumpang']),
            User::firstOrCreate(['email' => 'rizky.p@mail.com'], ['name' => 'Rizky Pratama', 'phone' => '081310000003', 'password' => $password, 'role' => 'penumpang']),
            User::firstOrCreate(['email' => 'nadia.k@mail.com'], ['name' => 'Nadia Kusuma', 'phone' => '081310000004', 'password' => $password, 'role' => 'penumpang']),
            User::firstOrCreate(['email' => 'fajar.n@mail.com'], ['name' => 'Fajar Nugroho', 'phone' => '081310000005', 'password' => $password, 'role' => 'penumpang']),
            User::firstOrCreate(['email' => 'dinda.m@mail.com'], ['name' => 'Dinda Maharani', 'phone' => '081310000006', 'password' => $password, 'role' => 'penumpang']),
        ];

        $dummyTemplates = [
            ['MacBook Air M1 Silver', 'Elektronik', 'Silver', 'Bogor', 'Manggarai'],
            ['Dompet Kulit & KMT', 'Non Elektronik', 'Coklat', 'Depok', 'Jakarta Kota'],
            ['Tas Ransel Eiger Hitam', 'Non Elektronik', 'Hitam', 'Bekasi', 'Sudirman'],
            ['Botol Minum Corkcicle', 'Non Elektronik', 'Putih', 'Bogor', 'Manggarai'],
            ['iPhone 14 Pro Hitam', 'Elektronik', 'Hitam', 'Tangerang', 'Duri'],
            ['Payung Lipat Biru', 'Non Elektronik', 'Biru', 'Universitas Indonesia', 'Manggarai'],
            ['Earphone TWS Sony Putih', 'Elektronik', 'Putih', 'Serpong', 'Tanah Abang'],
            ['Jaket Hoodie Uniqlo', 'Non Elektronik', 'Hitam', 'Cilebut', 'Jakarta Kota'],
            ['Amplop Uang Tunai', 'Uang Tunai', 'Putih', 'Bogor', 'Sudirman'],
            ['iPad Air Space Grey', 'Elektronik', 'Silver', 'Depok', 'Manggarai'],
        ];

        for ($i = 1; $i <= 100; $i++) {
            $tpl = $dummyTemplates[($i - 1) % count($dummyTemplates)];
            $u = $dummyUsers[($i - 1) % count($dummyUsers)];
            $kode = sprintf('HST-2026-%03d', $i);

            $lap = LaporanBarangHilang::updateOrCreate(
                ['kode' => $kode],
                [
                    'user_id'          => $u->id,
                    'stasiun_dari_id'  => $stasiunMap[$tpl[3]],
                    'stasiun_ke_id'    => $stasiunMap[$tpl[4]],
                    'tanggal_kejadian' => now()->subDays(($i % 25) + 1)->toDateString(),
                    'waktu_kejadian'   => sprintf('%02d:%02d', 7 + ($i % 10), ($i * 7) % 60),
                    'posisi_terakhir'  => 'Gerbong ' . (($i % 8) + 1) . ' - Rak Atas',
                    'ciri_rahasia'     => 'Ciri khusus terverifikasi petugas CS',
                    'status'           => 'selesai',
                    'notify'           => true,
                ]
            );

            DetailBarangHilang::updateOrCreate(
                ['laporan_id' => $lap->id, 'sub_kode' => 'A'],
                [
                    'kategori_id' => $catMap[$tpl[1]],
                    'nama_barang' => $tpl[0],
                    'warna'       => $tpl[2],
                ]
            );
        }

        /* ============================================================
         * 11. Log Audit Sistem (from AUDIT in data.ts)
         * ============================================================ */
        AuditLog::create(['who' => 'Rina K. (CS)', 'act' => 'Setujui klaim & terbitkan BAST', 'obj' => 'KLM-2026-109 • BAST #KCI-2026-089', 'res' => 'Berhasil']);
        AuditLog::create(['who' => 'Sistem', 'act' => 'Cocokkan otomatis', 'obj' => 'FND-0412 → LPR-2026-042', 'res' => 'Berhasil']);
        AuditLog::create(['who' => 'Dewi L. (CS)', 'act' => 'Catat barang temuan', 'obj' => 'FND-0412', 'res' => 'Berhasil']);
        AuditLog::create(['who' => 'Budi S. (CS)', 'act' => 'Tolak klaim', 'obj' => 'KLM-2026-104', 'res' => 'Ditolak: Ciri tidak sesuai']);
        AuditLog::create(['who' => 'Agus P. (Logistik)', 'act' => 'Input resi manual', 'obj' => 'LPR-2026-029', 'res' => 'Berhasil']);
        AuditLog::create(['who' => 'Hendra W. (Admin)', 'act' => 'Ubah retention_days', 'obj' => 'Kategori Payung (30 → 14)', 'res' => 'Berhasil']);
    }
}
