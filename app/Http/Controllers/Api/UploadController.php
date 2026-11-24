<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KlaimVerifikasi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UploadController extends Controller
{
    /**
     * Upload an image file. KTP uploads are stored on the private local disk (UU PDP).
     * POST /api/upload
     */
    public function upload(Request $request)
    {
        $request->validate([
            'file'    => 'required|file|mimes:jpeg,png,jpg,webp|max:5120',
            'purpose' => 'nullable|string|in:ktp,general',
        ]);

        $file = $request->file('file');
        $ext = $file->getClientOriginalExtension() ?: 'jpg';
        $filename = 'img_' . time() . '_' . Str::random(8) . '.' . $ext;
        $purpose = $request->input('purpose', 'general');

        if ($purpose === 'ktp') {
            $file->storeAs('ktp', $filename, 'local');

            return response()->json([
                'url'      => '/api/private-files/ktp/' . $filename,
                'filename' => $filename,
                'size'     => (round($file->getSize() / 1024 / 1024, 1)) . ' MB',
            ]);
        }

        $path = $file->storeAs('uploads', $filename, 'public');

        return response()->json([
            'url'      => '/storage/' . $path,
            'filename' => $filename,
            'size'     => (round($file->getSize() / 1024 / 1024, 1)) . ' MB',
        ]);
    }

    /**
     * Serve private KTP images only to authorized CS/Admin staff or the claim owner.
     * GET /api/private-files/ktp/{filename}
     */
    public function showKtp(Request $request, string $filename)
    {
        $user = $request->user();
        $safeName = basename($filename);
        $relPath = 'ktp/' . $safeName;

        $isAuthorizedStaff = $user && ($user->isStaff() || $user->role === 'debug');
        $isClaimOwner = $user && KlaimVerifikasi::where('bukti_tambahan', 'like', "%{$safeName}")
            ->whereHas('laporan', fn ($q) => $q->where('user_id', $user->id))
            ->exists();

        if (! $isAuthorizedStaff && ! $isClaimOwner) {
            return response()->json(['message' => 'Anda tidak memiliki akses ke dokumen identitas ini.'], 403);
        }

        if (! Storage::disk('local')->exists($relPath)) {
            return response()->json(['message' => 'Dokumen identitas sudah dihapus atau tidak ditemukan.'], 404);
        }

        return Storage::disk('local')->response($relPath);
    }
}
