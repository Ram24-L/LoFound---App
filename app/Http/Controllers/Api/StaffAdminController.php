<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\KategoriBarang;
use App\Models\Stasiun;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class StaffAdminController extends Controller
{
    /**
     * GET /api/staff/admin/users
     */
    public function users()
    {
        $roleLabels = [
            'cs'             => 'Petugas CS',
            'logistik'       => 'Petugas Logistik',
            'admin'          => 'Administrator Sistem',
            'kepala_stasiun' => 'Kepala Stasiun',
        ];

        $users = User::with('stasiun')
            ->where('role', '!=', 'penumpang')
            ->orderBy('id')
            ->get()
            ->map(function ($u) use ($roleLabels) {
                return [
                    'id'      => $u->id,
                    'name'    => $u->name,
                    'email'   => $u->email,
                    'role'    => $roleLabels[$u->role] ?? $u->role,
                    'station' => $u->stasiun?->nama ?? 'Pusat',
                    'active'  => true,
                ];
            });

        return response()->json($users);
    }

    /**
     * POST /api/staff/admin/users
     */
    public function storeUser(Request $request)
    {
        $request->validate([
            'name'    => 'required|string|max:100',
            'email'   => 'required|email|unique:users,email',
            'role'    => 'required|string',
            'station' => 'nullable|string',
        ]);

        $roleDbMap = [
            'Petugas CS'           => 'cs',
            'Petugas Logistik'     => 'logistik',
            'Administrator Sistem' => 'admin',
            'Kepala Stasiun'       => 'kepala_stasiun',
            'cs'                   => 'cs',
            'logistik'             => 'logistik',
            'admin'                => 'admin',
            'kepala_stasiun'       => 'kepala_stasiun',
            'manager'              => 'kepala_stasiun',
        ];

        $stasiun = null;
        if ($request->station && $request->station !== 'Pusat') {
            $stasiun = Stasiun::where('nama', $request->station)->first();
        }

        $user = User::create([
            'name'       => $request->name,
            'email'      => strtolower($request->email),
            'password'   => Hash::make('lofound2026'),
            'role'       => $roleDbMap[$request->role] ?? 'cs',
            'stasiun_id' => $stasiun?->id,
        ]);

        AuditLog::record($request->user()->id, $request->user()->name . ' (Admin)', 'Tambah staf baru', "{$user->name} • {$user->email}");

        return response()->json([
            'user' => [
                'id'      => $user->id,
                'name'    => $user->name,
                'email'   => $user->email,
                'role'    => $request->role,
                'station' => $stasiun?->nama ?? 'Pusat',
                'active'  => true,
            ],
        ]);
    }

    /**
     * GET /api/staff/admin/categories
     */
    public function categories()
    {
        $cats = KategoriBarang::withCount('detailBarangHilang')
            ->get()
            ->map(function ($c) {
                return [
                    'id'        => $c->id,
                    'name'      => $c->nama,
                    'icon'      => $c->nama,
                    'retention' => $c->retention_days ?? 30,
                    'shippable' => (bool) ($c->shippable ?? true),
                    'active'    => true,
                    'used'      => $c->detail_barang_hilang_count,
                ];
            });

        return response()->json($cats);
    }

    /**
     * POST /api/staff/admin/categories
     */
    public function storeCategory(Request $request)
    {
        $request->validate([
            'name'      => 'required|string|unique:kategori_barang,nama',
            'retention' => 'nullable|integer',
            'shippable' => 'nullable|boolean',
        ]);

        $cat = KategoriBarang::create([
            'nama'           => $request->name,
            'ikon'           => 'package',
            'retention_days' => $request->retention ?? 30,
            'shippable'      => $request->boolean('shippable', true),
        ]);

        AuditLog::record($request->user()->id, $request->user()->name . ' (Admin)', 'Tambah kategori', $cat->nama);

        return response()->json([
            'category' => [
                'id'        => $cat->id,
                'name'      => $cat->nama,
                'icon'      => 'Lainnya',
                'retention' => $cat->retention_days,
                'shippable' => $cat->shippable,
                'active'    => true,
                'used'      => 0,
            ],
        ]);
    }

    /**
     * PATCH /api/staff/admin/categories/{id}
     */
    public function updateCategory(Request $request, int $id)
    {
        $cat = KategoriBarang::findOrFail($id);

        if ($request->has('retention')) {
            $old = $cat->retention_days;
            $cat->retention_days = $request->retention;
            AuditLog::record($request->user()->id, $request->user()->name . ' (Admin)', 'Ubah retention_days', "{$cat->nama} ({$old} → {$cat->retention_days})");
        }
        if ($request->has('shippable')) {
            $cat->shippable = $request->boolean('shippable');
        }
        $cat->save();

        return response()->json(['ok' => true]);
    }

    /**
     * GET /api/staff/admin/stations
     */
    public function stations()
    {
        $st = Stasiun::orderBy('nama')->get()->map(function ($s, $i) {
            return [
                'code'   => $s->kode,
                'name'   => $s->nama,
                'line'   => $s->lin,
                'hours'  => '04:00–24:00',
                'active' => $i !== 11,
            ];
        });

        return response()->json($st);
    }

    /**
     * GET /api/staff/admin/audit-logs
     */
    public function auditLogs(Request $request)
    {
        $actor = $request->input('actor', 'Semua');
        $q = $request->input('q', '');

        $query = AuditLog::orderByDesc('created_at');

        if ($actor !== 'Semua') {
            $query->where('who', 'ilike', "%{$actor}%");
        }

        if ($q) {
            $query->where(function ($qb) use ($q) {
                $qb->where('act', 'ilike', "%{$q}%")
                   ->orWhere('obj', 'ilike', "%{$q}%")
                   ->orWhere('who', 'ilike', "%{$q}%");
            });
        }

        $logs = $query->limit(100)->get()->map(function ($l) {
            return [
                'id'  => $l->id,
                't'   => $l->created_at->format('j M, H:i'),
                'who' => $l->who,
                'act' => $l->act,
                'obj' => $l->obj,
                'res' => $l->res,
            ];
        });

        return response()->json($logs);
    }
}
