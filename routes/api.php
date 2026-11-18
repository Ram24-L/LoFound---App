<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\HomeController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\StaffAdminController;
use App\Http\Controllers\Api\StaffAuthController;
use App\Http\Controllers\Api\StaffCsController;
use App\Http\Controllers\Api\StaffLogisticsController;
use App\Http\Controllers\Api\StaffManagerController;
use App\Http\Controllers\Api\UploadController;
use App\Models\KategoriBarang;
use App\Models\Stasiun;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes (session-based, same domain SPA)
|--------------------------------------------------------------------------
*/

// Public endpoints
Route::get('/home-stats', [HomeController::class, 'stats']);
Route::get('/home-feed', [HomeController::class, 'feed']);
Route::get('/stations', fn () => Stasiun::orderBy('nama')->get(['id', 'kode', 'nama', 'lin']));
Route::get('/categories', fn () => KategoriBarang::where('active', true)->get(['id', 'nama', 'ikon', 'shippable']));
Route::post('/upload', [UploadController::class, 'upload']);

// Auth
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/otp', [AuthController::class, 'otpLogin']);
Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth');
Route::get('/auth/user', [AuthController::class, 'user']);

// Protected passenger routes
Route::middleware('auth')->group(function () {
    Route::get('/reports', [ReportController::class, 'index']);
    Route::post('/reports', [ReportController::class, 'store']);
    Route::post('/reports/check-duplicate', [ReportController::class, 'checkDuplicate']);
    Route::post('/reports/cancel', [ReportController::class, 'cancel']);
    Route::post('/reports/merge', [ReportController::class, 'merge']);
    Route::patch('/reports/{kode}', [ReportController::class, 'update']);
    Route::post('/reports/{kode}/reactivate', [ReportController::class, 'reactivate']);
    Route::get('/reports/{kode}/candidates', [ReportController::class, 'candidates']);
    Route::post('/reports/{kode}/claim', [ReportController::class, 'claim']);
    Route::post('/reports/{kode}/bast', [ReportController::class, 'bast']);
});

/*
|--------------------------------------------------------------------------
| Staff API Routes (RBAC Protected)
|--------------------------------------------------------------------------
*/
// Staff Auth
Route::post('/staff/auth/login', [StaffAuthController::class, 'login']);
Route::post('/staff/auth/logout', [StaffAuthController::class, 'logout'])->middleware('auth');
Route::get('/staff/auth/user', [StaffAuthController::class, 'user']);

// Protected Staff routes
Route::middleware('auth')->prefix('staff')->group(function () {
    // CS routes
    Route::middleware('staff.role:cs,admin,manager')->group(function () {
        Route::get('/cs/dashboard', [StaffCsController::class, 'dashboard']);
        Route::get('/cs/reports', [StaffCsController::class, 'activeReports']);
        Route::post('/cs/found-items', [StaffCsController::class, 'storeFoundItem']);
        Route::patch('/cs/found-items/{kode}', [StaffCsController::class, 'updateFoundItem']);
        Route::post('/cs/found-items/{kode}/status', [StaffCsController::class, 'changeStatus']);
        Route::post('/cs/found-items/{kode}/match', [StaffCsController::class, 'manualMatch']);
        Route::post('/cs/claims/{id}/verify', [StaffCsController::class, 'verifyClaim']);
        Route::post('/cs/bast/handover', [StaffCsController::class, 'handover']);
    });

    // Logistics routes
    Route::middleware('staff.role:logistik,admin,manager')->group(function () {
        Route::get('/logistics/inventory', [StaffLogisticsController::class, 'inventory']);
        Route::patch('/logistics/found-items/{id}', [StaffLogisticsController::class, 'updateItem']);
        Route::post('/logistics/shipments/{id}/ship', [StaffLogisticsController::class, 'shipOrder']);
    });

    // Admin routes
    Route::middleware('staff.role:admin,manager')->group(function () {
        Route::get('/admin/users', [StaffAdminController::class, 'users']);
        Route::post('/admin/users', [StaffAdminController::class, 'storeUser']);
        Route::get('/admin/categories', [StaffAdminController::class, 'categories']);
        Route::post('/admin/categories', [StaffAdminController::class, 'storeCategory']);
        Route::patch('/admin/categories/{id}', [StaffAdminController::class, 'updateCategory']);
        Route::get('/admin/stations', [StaffAdminController::class, 'stations']);
        Route::get('/admin/audit-logs', [StaffAdminController::class, 'auditLogs']);
    });

    // Manager routes
    Route::middleware('staff.role:manager,admin')->group(function () {
        Route::get('/manager/stats', [StaffManagerController::class, 'stats']);
    });
});
