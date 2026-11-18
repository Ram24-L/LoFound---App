<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class StaffRole
{
    /**
     * Handle an incoming request.
     * Usage: ->middleware('staff.role:cs,logistik')
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Debug / superuser account has full access to all staff endpoints
        if ($user->role === 'debug') {
            return $next($request);
        }

        // Map database roles to the short role keys used in the frontend
        $roleMap = [
            'cs'              => 'cs',
            'logistik'        => 'logistik',
            'admin'           => 'admin',
            'kepala_stasiun'  => 'manager',
        ];

        $userRoleKey = $roleMap[$user->role] ?? null;

        if (!$userRoleKey || !in_array($userRoleKey, $roles)) {
            return response()->json(['message' => 'Akses dibatasi. Anda tidak memiliki izin untuk halaman ini.'], 403);
        }

        return $next($request);
    }
}
