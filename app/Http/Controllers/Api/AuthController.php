<?php

namespace App\Http\Controllers\Api;

use App\Http\Middleware\ResolveTabToken;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'contact'  => 'required|string',
            'password' => 'required|string',
        ]);

        $contact = $request->input('contact');
        $field = filter_var($contact, FILTER_VALIDATE_EMAIL) ? 'email' : 'phone';

        $user = User::where($field, $contact)->first();

        if (! $user || ! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages([
                'contact' => ['Email/nomor atau kata sandi tidak sesuai.'],
            ]);
        }

        Auth::login($user, $request->boolean('remember', true));

        return response()->json([
            'token' => ResolveTabToken::createToken($user),
            'user'  => [
                'name'    => explode(' ', $user->name)[0],
                'full'    => $user->name,
                'contact' => $user->email ?? $user->phone,
                'nik'     => null,
            ],
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name'     => 'required|string|max:100',
            'contact'  => 'required|string',
            'password' => 'required|string|min:8',
        ]);

        $contact = $request->input('contact');
        $isEmail = filter_var($contact, FILTER_VALIDATE_EMAIL);

        // Check uniqueness
        $field = $isEmail ? 'email' : 'phone';
        if (User::where($field, $contact)->exists()) {
            throw ValidationException::withMessages([
                'contact' => ['Akun dengan ' . ($isEmail ? 'email' : 'nomor') . ' ini sudah terdaftar.'],
            ]);
        }

        $user = User::create([
            'name'     => $request->input('name'),
            'email'    => $isEmail ? $contact : null,
            'phone'    => $isEmail ? null : $contact,
            'password' => $request->input('password'),
            'role'     => 'penumpang',
        ]);

        Auth::login($user);

        return response()->json([
            'token' => ResolveTabToken::createToken($user),
            'user'  => [
                'name'    => explode(' ', $user->name)[0],
                'full'    => $user->name,
                'contact' => $contact,
                'nik'     => null,
            ],
        ], 201);
    }

    public function logout(Request $request): JsonResponse
    {
        if (! $request->hasHeader('X-Tab-Token')) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'Anda telah keluar.']);
    }

    public function user(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user || $user->role !== 'penumpang') {
            return response()->json(['user' => null]);
        }

        return response()->json([
            'token' => ResolveTabToken::createToken($user),
            'user'  => [
                'name'    => explode(' ', $user->name)[0],
                'full'    => $user->name,
                'contact' => $user->email ?? $user->phone,
                'nik'     => null,
            ],
        ]);
    }

    public function otpLogin(Request $request): JsonResponse
    {
        $request->validate([
            'phone' => 'required|string',
            'otp'   => 'required|string|size:6',
        ]);

        $phone = $request->input('phone');
        $user = User::where('phone', $phone)->first();

        if (! $user) {
            $user = User::create([
                'name'     => 'Penumpang ' . substr($phone, -4),
                'phone'    => $phone,
                'password' => Hash::make('password123'),
                'role'     => 'penumpang',
            ]);
        }

        Auth::login($user, true);

        return response()->json([
            'token' => ResolveTabToken::createToken($user),
            'user'  => [
                'name'    => explode(' ', $user->name)[0],
                'full'    => $user->name,
                'contact' => $user->phone,
                'nik'     => null,
            ],
        ]);
    }
}
