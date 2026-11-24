<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Middleware\ResolveTabToken;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class StaffAuthController extends Controller
{
    /**
     * Staff login — validates email + password against DB and auto-detects RBAC role.
     */
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $email = strtolower(trim($request->email));
        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Email atau kata sandi salah.'], 422);
        }

        if ($user->role === 'penumpang') {
            return response()->json(['message' => 'Akun ini bukan akun petugas.'], 403);
        }

        if ($user->active === false) {
            return response()->json(['message' => 'Akun petugas ini telah dinonaktifkan.'], 403);
        }

        // Only set cookie session if no user is currently logged into the cookie session,
        // so logging in as Staff in Tab 2 never logs out a Passenger in Tab 1!
        if (! Auth::check()) {
            Auth::login($user, true);
        }

        $roleMap = [
            'cs'             => 'cs',
            'logistik'       => 'logistik',
            'admin'          => 'admin',
            'kepala_stasiun' => 'manager',
            'debug'          => 'debug',
        ];

        $stasiun = $user->stasiun;

        AuditLog::record($user->id, $user->name . ' (' . ucfirst($user->role) . ')', 'Login', 'Konsol Petugas');

        return response()->json([
            'token' => ResolveTabToken::createToken($user),
            'user'  => [
                'id'       => $user->id,
                'name'     => $user->name,
                'email'    => $user->email,
                'role'     => $roleMap[$user->role] ?? $user->role,
                'station'  => $stasiun ? $stasiun->nama : 'Pusat',
                'initials' => collect(explode(' ', $user->name))->map(fn ($w) => mb_strtoupper(mb_substr($w, 0, 1)))->take(2)->join(''),
            ],
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        if ($user) {
            AuditLog::record($user->id, $user->name, 'Logout', 'Konsol Petugas');
        }
        if (! $request->hasHeader('X-Tab-Token')) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['ok' => true]);
    }

    public function user(Request $request)
    {
        $user = $request->user();
        if (! $user || $user->role === 'penumpang') {
            return response()->json(['user' => null]);
        }

        $roleMap = [
            'cs'             => 'cs',
            'logistik'       => 'logistik',
            'admin'          => 'admin',
            'kepala_stasiun' => 'manager',
            'debug'          => 'debug',
        ];

        $stasiun = $user->stasiun;

        return response()->json([
            'token' => ResolveTabToken::createToken($user),
            'user'  => [
                'id'       => $user->id,
                'name'     => $user->name,
                'email'    => $user->email,
                'role'     => $roleMap[$user->role] ?? $user->role,
                'station'  => $stasiun ? $stasiun->nama : 'Pusat',
                'initials' => collect(explode(' ', $user->name))->map(fn ($w) => mb_strtoupper(mb_substr($w, 0, 1)))->take(2)->join(''),
            ],
        ]);
    }
}
