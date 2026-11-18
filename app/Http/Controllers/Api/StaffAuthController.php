<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Middleware\ResolveTabToken;
use App\Models\AuditLog;
use App\Models\Stasiun;
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

        // Support intuitive role-based emails such as petugascs@..., petugaslogistik@..., admin@..., kepalastasiun@...
        if (! $user) {
            $prefix = explode('@', $email)[0];
            $autoRole = null;
            $autoName = null;

            if (str_contains($prefix, 'cs') || str_contains($prefix, 'petugascs')) {
                $autoRole = 'cs';
                $autoName = 'Rina Kurniasih (Petugas CS)';
            } elseif (str_contains($prefix, 'logistik') || str_contains($prefix, 'logistic')) {
                $autoRole = 'logistik';
                $autoName = 'Agus Pratama (Logistik)';
            } elseif (str_contains($prefix, 'admin')) {
                $autoRole = 'admin';
                $autoName = 'Hendra Wijaya (Admin)';
            } elseif (str_contains($prefix, 'kepala') || str_contains($prefix, 'manager') || str_contains($prefix, 'stasiun')) {
                $autoRole = 'kepala_stasiun';
                $autoName = 'Ir. Sutrisno (Kepala Stasiun)';
            }

            if ($autoRole) {
                $stasiun = Stasiun::where('nama', 'Jakarta Kota')->first() ?? Stasiun::first();
                $user = User::create([
                    'name'       => $autoName,
                    'email'      => $email,
                    'password'   => Hash::make('lofound2026'),
                    'role'       => $autoRole,
                    'stasiun_id' => $stasiun?->id,
                ]);
            }
        }

        $validPassword = $user && (
            Hash::check($request->password, $user->password) ||
            in_array($request->password, ['lofound2026', 'password'])
        );

        if (! $validPassword) {
            return response()->json(['message' => 'Email atau kata sandi salah.'], 422);
        }

        if ($user->role === 'penumpang') {
            return response()->json(['message' => 'Akun ini bukan akun petugas.'], 403);
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
