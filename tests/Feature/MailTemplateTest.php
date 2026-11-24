<?php

namespace Tests\Feature;

use App\Mail\LoFoundOtpMail;
use App\Mail\LoFoundReportMail;
use App\Models\DetailBarangHilang;
use App\Models\KategoriBarang;
use App\Models\LaporanBarangHilang;
use App\Models\Stasiun;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class MailTemplateTest extends TestCase
{
    use DatabaseTransactions;

    public function test_otp_email_renders_clean_code_card_in_html_and_text(): void
    {
        Mail::fake();

        NotificationService::sendOtp('penumpang@example.com', '518877');

        Mail::assertSent(LoFoundOtpMail::class, function (LoFoundOtpMail $mail) {
            $mail->assertTo('penumpang@example.com');
            $mail->assertHasSubject('[LoFound] Kode verifikasi email Anda');
            $mail->assertSeeInHtml('KODE DIMINTA');
            $mail->assertSeeInHtml('518877');
            $mail->assertSeeInHtml('LoFound');
            $mail->assertSeeInText('518877');
            $mail->assertSeeInText('LoFound');

            return true;
        });
    }

    public function test_report_notification_email_renders_summary_table_and_details(): void
    {
        Mail::fake();

        $user = User::create([
            'name'     => 'Budi Santoso',
            'email'    => 'budi.notif@example.com',
            'password' => bcrypt('password'),
            'role'     => 'penumpang',
            'phone'    => '081234500999',
        ]);

        $stasiunDari = Stasiun::first() ?? Stasiun::create(['kode' => 'BGR', 'nama' => 'Bogor', 'lin' => 'Bogor']);
        $stasiunKe = Stasiun::where('id', '!=', $stasiunDari->id)->first()
            ?? Stasiun::create(['kode' => 'SUD', 'nama' => 'Sudirman', 'lin' => 'Bogor']);
        $kategori = KategoriBarang::first() ?? KategoriBarang::create(['nama' => 'Elektronik', 'sla_hari' => 30]);

        $laporan = LaporanBarangHilang::create([
            'kode'             => 'LPR-TEST-901',
            'user_id'          => $user->id,
            'stasiun_dari_id'  => $stasiunDari->id,
            'stasiun_ke_id'    => $stasiunKe->id,
            'tanggal_kejadian' => now()->toDateString(),
            'waktu_kejadian'   => '08:15',
            'posisi_terakhir'  => 'Rak bagasi gerbong 3',
            'ciri_rahasia'     => 'Ada stiker IPB di pojok kiri',
            'status'           => 'kandidat',
            'notify'           => true,
        ]);

        DetailBarangHilang::create([
            'laporan_id'  => $laporan->id,
            'sub_kode'    => 'A',
            'kategori_id' => $kategori->id,
            'nama_barang' => 'Laptop MacBook',
            'warna'       => 'Silver',
        ]);

        NotificationService::notifyReport(
            $laporan,
            'Kandidat Barang Cocok Ditemukan',
            'Petugas menemukan barang yang berpotensi cocok dengan laporan Anda.',
            ['details' => ['Kode Temuan' => 'FND-9999']]
        );

        Mail::assertSent(LoFoundReportMail::class, function (LoFoundReportMail $mail) use ($stasiunDari, $stasiunKe) {
            $mail->assertTo('budi.notif@example.com');
            $mail->assertHasSubject('[LoFound] Kandidat Barang Cocok Ditemukan (#LPR-TEST-901)');
            $mail->assertSeeInHtml('Budi Santoso');
            $mail->assertSeeInHtml('#LPR-TEST-901');
            $mail->assertSeeInHtml('Laptop MacBook (Silver)');
            $mail->assertSeeInHtml("{$stasiunDari->nama}");
            $mail->assertSeeInHtml("{$stasiunKe->nama}");
            $mail->assertSeeInHtml('Kandidat Ditemukan');
            $mail->assertSeeInHtml('FND-9999');
            $mail->assertSeeInText('Laptop MacBook (Silver)');
            $mail->assertSeeInText('FND-9999');

            return true;
        });
    }

    public function test_report_notification_is_skipped_when_notify_is_disabled(): void
    {
        Mail::fake();

        $user = User::create([
            'name'     => 'Siti Aminah',
            'email'    => 'siti.off@example.com',
            'password' => bcrypt('password'),
            'role'     => 'penumpang',
            'phone'    => '081234500888',
        ]);

        $stasiun = Stasiun::first() ?? Stasiun::create(['kode' => 'MRI', 'nama' => 'Manggarai', 'lin' => 'Bogor']);

        $laporan = LaporanBarangHilang::create([
            'kode'             => 'LPR-TEST-902',
            'user_id'          => $user->id,
            'stasiun_dari_id'  => $stasiun->id,
            'stasiun_ke_id'    => $stasiun->id,
            'tanggal_kejadian' => now()->toDateString(),
            'waktu_kejadian'   => '09:00',
            'posisi_terakhir'  => 'Peron 4',
            'ciri_rahasia'     => 'Gantungan kunci biru',
            'status'           => 'kandidat',
            'notify'           => false,
        ]);

        NotificationService::notifyReport(
            $laporan,
            'Kandidat Barang Cocok Ditemukan',
            'Pesan ini seharusnya tidak dikirim.'
        );

        Mail::assertNothingSent();
    }
}
