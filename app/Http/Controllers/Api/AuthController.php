<?php

namespace App\Http\Controllers\Api;

use App\Http\Middleware\ResolveTabToken;
use App\Models\AuditLog;
use App\Models\BarangTemuan;
use App\Models\KlaimVerifikasi;
use App\Models\User;
use App\Services\OtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
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

        if ($user->active === false) {
            throw ValidationException::withMessages([
                'contact' => ['Akun ini telah dinonaktifkan.'],
            ]);
        }

        Auth::login($user, $request->boolean('remember', true));

        return response()->json([
            'token' => ResolveTabToken::createToken($user),
            'user'  => $this->mapUser($user),
        ]);
    }

    public function register(Request $request, OtpService $otpService): JsonResponse
    {
        $request->validate([
            'name'     => 'required|string|max:100',
            'contact'  => 'required|string',
            'password' => 'required|string|min:8',
            'otp'      => 'nullable|string|size:6',
        ]);

        $contact = $request->input('contact');
        $isEmail = (bool) filter_var($contact, FILTER_VALIDATE_EMAIL);

        if ($request->filled('otp') && ! $otpService->verify($contact, (string) $request->input('otp'))) {
            throw ValidationException::withMessages([
                'otp' => ['Kode OTP tidak valid atau sudah kedaluwarsa.'],
            ]);
        }

        // Check uniqueness
        $field = $isEmail ? 'email' : 'phone';
        if (User::where($field, $contact)->exists()) {
            throw ValidationException::withMessages([
                'contact' => ['Akun dengan ' . ($isEmail ? 'email' : 'nomor') . ' ini sudah terdaftar.'],
            ]);
        }

        $cleanPhone = preg_replace('/\D+/', '', $contact) ?: Str::random(8);
        $user = User::create([
            'name'     => $request->input('name'),
            'email'    => $isEmail ? $contact : "{$cleanPhone}@wa.lofound.local",
            'phone'    => $isEmail ? null : $contact,
            'password' => $request->input('password'),
            'role'     => 'penumpang',
        ]);

        Auth::login($user);

        return response()->json([
            'token' => ResolveTabToken::createToken($user),
            'user'  => $this->mapUser($user),
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
            'user'  => $this->mapUser($user),
        ]);
    }

    public function sendOtp(Request $request, OtpService $otpService): JsonResponse
    {
        $request->validate([
            'contact' => 'nullable|string',
            'phone'   => 'nullable|string',
            'purpose' => 'nullable|string|in:login,register',
        ]);

        $contact = trim((string) ($request->input('contact') ?: $request->input('phone')));
        if (! $contact) {
            throw ValidationException::withMessages([
                'contact' => ['Nomor WhatsApp atau email wajib diisi.'],
            ]);
        }

        if ($request->input('purpose') === 'register') {
            $isEmail = (bool) filter_var($contact, FILTER_VALIDATE_EMAIL);
            if (User::where($isEmail ? 'email' : 'phone', $contact)->exists()) {
                throw ValidationException::withMessages([
                    'contact' => ['Akun dengan ' . ($isEmail ? 'email' : 'nomor') . ' ini sudah terdaftar. Silakan masuk.'],
                ]);
            }
        }

        return response()->json($otpService->send($contact));
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'name'     => 'nullable|string|max:100',
            'nik'      => 'nullable|string|max:20',
            'address'  => 'nullable|array',
            'password' => 'nullable|string|min:8',
        ]);

        if ($request->filled('name')) {
            $user->name = $request->input('name');
        }
        if ($request->has('nik')) {
            $user->nik = $request->input('nik');
        }
        if ($request->has('address')) {
            $user->address = $request->input('address');
        }
        if ($request->filled('password')) {
            $user->password = $request->input('password');
        }

        $user->save();

        return response()->json([
            'user' => $this->mapUser($user->fresh()),
        ]);
    }

    public function transactions(Request $request): JsonResponse
    {
        $user = $request->user();

        $basts = \App\Models\BastPengambilan::with(['klaim.laporan.items'])
            ->where('metode_ambil', 'ekspedisi')
            ->whereHas('klaim.laporan', fn ($q) => $q->where('user_id', $user->id))
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($b) {
                $lap = $b->klaim?->laporan;
                $item = $lap?->items?->first();

                return [
                    'id'          => $b->id,
                    'bast_code'   => $b->kode,
                    'report_code' => $lap?->kode ?? '-',
                    'item'        => $item?->nama_barang ?? 'Barang Temuan',
                    'courier'     => $b->kurir ?? 'KAI Logistik Express',
                    'amount'      => $b->ongkir ?? 25500,
                    'status'      => $b->status_bayar ?? 'lunas',
                    'awb'         => $b->nomor_resi,
                    'address'     => $b->alamat_kirim,
                    'date'        => $b->created_at?->format('j M Y, H:i') ?? '',
                ];
            });

        return response()->json($basts);
    }

    public function deleteTransaction(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $bast = \App\Models\BastPengambilan::whereHas('klaim.laporan', fn ($q) => $q->where('user_id', $user->id))
            ->findOrFail($id);

        $bast->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Permanently delete the authenticated passenger account and its personal data.
     * DELETE /api/auth/account
     */
    public function deleteAccount(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $user->isPenumpang()) {
            return response()->json([
                'message' => 'Penghapusan akun mandiri hanya tersedia untuk akun penumpang.',
            ], 403);
        }

        $ktpPaths = [];

        DB::transaction(function () use ($user, &$ktpPaths) {
            $claims = KlaimVerifikasi::whereHas('laporan', fn ($q) => $q->where('user_id', $user->id))->get();

            $temuanIds = $claims->pluck('barang_temuan_id')->filter()->unique()->values();
            if ($temuanIds->isNotEmpty()) {
                BarangTemuan::whereIn('id', $temuanIds)
                    ->where('status_simpan', 'Dalam Klaim')
                    ->update(['status_simpan' => 'Tersimpan']);
            }

            foreach ($claims as $claim) {
                if ($claim->bukti_tambahan && str_contains($claim->bukti_tambahan, '/ktp/')) {
                    $ktpPaths[] = 'ktp/' . basename($claim->bukti_tambahan);
                }
            }

            AuditLog::record(
                null,
                $user->name,
                'Hapus akun penumpang permanen',
                $user->email ?: ($user->phone ?: 'USER-' . $user->id),
                'Berhasil'
            );

            $user->delete();
        });

        foreach (array_unique($ktpPaths) as $path) {
            Storage::disk('local')->delete($path);
        }

        if (! $request->hasHeader('X-Tab-Token')) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['ok' => true]);
    }

    private function mapUser(User $user): array
    {
        return [
            'name'    => explode(' ', $user->name)[0],
            'full'    => $user->name,
            'contact' => $user->email ?? $user->phone,
            'nik'     => $user->nik,
            'address' => $user->address,
        ];
    }
}
