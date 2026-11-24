<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            \Illuminate\Cookie\Middleware\EncryptCookies::class,
            \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
            \Illuminate\Session\Middleware\StartSession::class,
            \Illuminate\View\Middleware\ShareErrorsFromSession::class,
            \App\Http\Middleware\ResolveTabToken::class,
        ]);
        $middleware->alias([
            'staff.role' => \App\Http\Middleware\StaffRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (\Throwable $e, Request $request) {
            if (! ($request->is('api/*') || $request->expectsJson())) {
                return null;
            }

            if ($e instanceof \Illuminate\Validation\ValidationException) {
                $firstMsg = collect($e->errors())->flatten()->first();
                return response()->json([
                    'message' => is_string($firstMsg) ? $firstMsg : 'Periksa kembali data yang Anda masukkan.',
                    'errors'  => $e->errors(),
                ], 422);
            }

            if ($e instanceof \Illuminate\Auth\AuthenticationException) {
                return response()->json([
                    'message' => 'Sesi Anda telah berakhir. Silakan masuk kembali.',
                ], 401);
            }

            if ($e instanceof \Illuminate\Auth\Access\AuthorizationException) {
                return response()->json([
                    'message' => 'Anda tidak memiliki izin untuk melakukan tindakan ini.',
                ], 403);
            }

            if ($e instanceof \Illuminate\Database\Eloquent\ModelNotFoundException || $e instanceof \Symfony\Component\HttpKernel\Exception\NotFoundHttpException) {
                return response()->json([
                    'message' => 'Data yang diminta tidak ditemukan.',
                ], 404);
            }

            if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                $status = $e->getStatusCode();
                $msg = $status === 419
                    ? 'Sesi keamanan halaman kedaluwarsa. Silakan muat ulang atau coba lagi.'
                    : ($e->getMessage() ?: 'Permintaan tidak dapat diproses.');
                return response()->json(['message' => $msg], $status);
            }

            \Illuminate\Support\Facades\Log::error('Unhandled API exception', [
                'url'       => $request->fullUrl(),
                'method'    => $request->method(),
                'exception' => get_class($e),
                'message'   => $e->getMessage(),
            ]);

            return response()->json([
                'message' => $e instanceof \Illuminate\Database\QueryException
                    ? 'Terjadi kesalahan saat menyimpan data. Periksa kelengkapan isian lalu coba lagi.'
                    : 'Terjadi gangguan pada server. Silakan coba beberapa saat lagi.',
            ], 500);
        });
    })->create();
