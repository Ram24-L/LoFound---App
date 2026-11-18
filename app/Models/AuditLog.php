<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use HasFactory;

    protected $table = 'audit_logs';

    protected $fillable = [
        'user_id',
        'who',
        'act',
        'obj',
        'res',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function record(?int $userId, string $who, string $act, string $obj, string $res = 'Berhasil'): self
    {
        return self::create([
            'user_id' => $userId,
            'who'     => $who,
            'act'     => $act,
            'obj'     => $obj,
            'res'     => $res,
        ]);
    }
}
