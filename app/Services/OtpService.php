<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class OtpService
{
    public function send(string $contact): array
    {
        $norm = $this->normalize($contact);
        $rateKey = "lofound:otp_rate:{$norm}";

        if (RateLimiter::tooManyAttempts($rateKey, 3)) {
            $seconds = RateLimiter::availableIn($rateKey);
            throw ValidationException::withMessages([
                'contact' => ["Terlalu banyak permintaan OTP. Coba lagi dalam {$seconds} detik."],
            ]);
        }

        RateLimiter::hit($rateKey, 600);

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        Cache::put($this->cacheKey($norm), [
            'hash'     => Hash::make($code),
            'attempts' => 0,
        ], now()->addMinutes(5));

        NotificationService::sendOtp($contact, $code);

        $isEmail = (bool) filter_var($contact, FILTER_VALIDATE_EMAIL);
        $isLiveChannel = $isEmail
            ? ! in_array(config('mail.default'), ['log', 'array', null, ''], true)
            : ! empty(config('services.whatsapp.token'));

        return [
            'sent'       => true,
            'channel'    => $isEmail ? 'email' : 'whatsapp',
            'live'       => $isLiveChannel,
            'expires_in' => 300,
            'dev_otp'    => app()->environment('local', 'testing') && ! $isLiveChannel ? $code : null,
        ];
    }

    public function verify(string $contact, string $otp): bool
    {
        $norm = $this->normalize($contact);
        $key = $this->cacheKey($norm);
        $record = Cache::get($key);

        if (! $record) {
            // Allow legacy demo fallback strictly in local/testing when no OTP was requested
            if (app()->environment('local', 'testing') && $otp === '123456') {
                return true;
            }
            return false;
        }

        if (($record['attempts'] ?? 0) >= 5) {
            Cache::forget($key);
            return false;
        }

        if (! Hash::check($otp, $record['hash'])) {
            $record['attempts'] = ($record['attempts'] ?? 0) + 1;
            Cache::put($key, $record, now()->addMinutes(5));
            return false;
        }

        Cache::forget($key);
        return true;
    }

    private function normalize(string $contact): string
    {
        return strtolower(trim($contact));
    }

    private function cacheKey(string $norm): string
    {
        return 'lofound:otp:' . sha1($norm);
    }
}
