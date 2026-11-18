<?php

use Illuminate\Support\Facades\Route;

// All routes serve the React SPA via Blade
Route::get('/{any?}', function () {
    return view('welcome');
})->where('any', '.*');
