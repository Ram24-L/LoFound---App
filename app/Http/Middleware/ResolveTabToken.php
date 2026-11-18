<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class ResolveTabToken
{
    public static function createToken(User $user): string
    {
        $payload = (string) $user->id;
        $sig = hash_hmac('sha256', $payload, config('app.key') ?: 'lofound-key');

        return base64_encode($payload . ':' . $sig);
    }

    public static function resolveUser(?string $token): ?User
    {
        if (! $token) {
            return null;
        }

        $decoded = base64_decode($token, true);
        if (! $decoded || ! str_contains($decoded, ':')) {
            return null;
        }

        [$id, $sig] = explode(':', $decoded, 2);
        $expected = hash_hmac('sha256', $id, config('app.key') ?: 'lofound-key');

        if (! hash_equals($expected, $sig)) {
            return null;
        }

        return User::find((int) $id);
    }

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->header('X-Tab-Token');
        if ($token) {
            $user = self::resolveUser($token);
            if ($user) {
                Auth::setUser($user);
                $request->setUserResolver(fn () => $user);
            }
        }

        return $next($request);
    }
}
