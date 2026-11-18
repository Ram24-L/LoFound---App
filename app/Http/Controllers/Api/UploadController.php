<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UploadController extends Controller
{
    /**
     * Upload an image file to public storage.
     * POST /api/upload
     */
    public function upload(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:jpeg,png,jpg,webp|max:5120',
        ]);

        $file = $request->file('file');
        $filename = 'img_' . time() . '_' . Str::random(8) . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs('uploads', $filename, 'public');

        return response()->json([
            'url'      => '/storage/' . $path,
            'filename' => $filename,
            'size'     => (round($file->getSize() / 1024 / 1024, 1)) . ' MB',
        ]);
    }
}
