<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class ResolveTabToken
{
    private const TOKEN_TTL_SECONDS = 86400; // 24 hours

    public static function createToken(User $user): string
    {
        $key = (string) config('app.key');
        if ($key === '') {
            throw new \RuntimeException('APP_KEY is not configured.');
        }

        $exp = time() + self::TOKEN_TTL_SECONDS;
        $payload = $user->id . ':' . $exp;
        $sig = hash_hmac('sha256', $payload, $key);

        return base64_encode($payload . ':' . $sig);
    }

    public static function revokeToken(?string $token): void
    {
        if (! $token) {
            return;
        }

        Cache::put('lofound:revoked_tab:' . hash('sha256', $token), true, now()->addSeconds(self::TOKEN_TTL_SECONDS));
    }

    public static function resolveUser(?string $token): ?User
    {
        if (! $token) {
            return null;
        }

        $key = (string) config('app.key');
        if ($key === '') {
            return null;
        }

        if (Cache::get('lofound:revoked_tab:' . hash('sha256', $token))) {
            return null;
        }

        $decoded = base64_decode($token, true);
        if (! $decoded) {
            return null;
        }

        $parts = explode(':', $decoded, 3);
        if (count($parts) !== 3) {
            return null;
        }

        [$id, $exp, $sig] = $parts;
        if (! ctype_digit($id) || ! ctype_digit($exp) || (int) $exp < time()) {
            return null;
        }

        $expected = hash_hmac('sha256', $id . ':' . $exp, $key);
        if (! hash_equals($expected, $sig)) {
            return null;
        }

        $user = User::find((int) $id);
        if (! $user || $user->active === false) {
            return null;
        }

        return $user;
    }

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->hasHeader('X-Tab-Token')) {
            $user = self::resolveUser($request->header('X-Tab-Token'));
            if ($user) {
                Auth::setUser($user);
                $request->setUserResolver(fn () => $user);
            } else {
                Auth::forgetGuards();
                $request->setUserResolver(fn () => null);
            }
        }

        return $next($request);
    }
}
