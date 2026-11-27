<?php

use App\Http\Middleware\ResolveTabToken;
use App\Models\LaporanBarangHilang;
use App\Models\User;
use App\Services\PaymentGatewayService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

// Signed redirect target after completing/cancelling/closing external payment checkout
Route::get('/payment/return/{kode}', function (Request $request, string $kode) {
    $uid = (string) $request->query('uid', '');
    $exp = (string) $request->query('exp', '');
    $sig = (string) $request->query('sig', '');

    if (PaymentGatewayService::verifyReturnSignature($kode, $uid, $exp, $sig)) {
        $user = User::where('id', (int) $uid)
            ->where('role', 'penumpang')
            ->where('active', true)
            ->first();

        $laporan = $user
            ? LaporanBarangHilang::where('kode', $kode)->where('user_id', $user->id)->first()
            : null;

        if ($user && $laporan) {
            if (! Auth::check() || Auth::user()?->role === 'penumpang') {
                Auth::login($user, true);
            }

            return view('welcome', [
                'paymentReturn' => [
                    'reportId' => $laporan->kode,
                    'tabToken' => ResolveTabToken::createToken($user),
                ],
            ]);
        }
    }

    return view('welcome');
});

// All routes serve the React SPA via Blade
Route::get('/{any?}', function () {
    return view('welcome');
})->where('any', '.*');
