<?php

namespace App\Jobs;

use App\Mail\LoFoundOtpMail;
use App\Mail\LoFoundReportMail;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendLoFoundNotification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(
        public ?string $email,
        public ?string $phone,
        public string $title,
        public string $body,
        public string $type = 'report',
        public ?string $otpCode = null,
        public array $meta = [],
    ) {}

    public function handle(): void
    {
        if ($this->email) {
            try {
                if ($this->type === 'otp' && $this->otpCode) {
                    Mail::to($this->email)->send(new LoFoundOtpMail(
                        code: $this->otpCode,
                        recipientEmail: $this->email,
                    ));
                } else {
                    Mail::to($this->email)->send(new LoFoundReportMail(
                        title: $this->title,
                        body: $this->body,
                        recipientName: $this->meta['recipient_name'] ?? null,
                        reportCode: $this->meta['report_code'] ?? null,
                        itemName: $this->meta['item_name'] ?? null,
                        routeLabel: $this->meta['route_label'] ?? null,
                        statusLabel: $this->meta['status_label'] ?? null,
                        tone: $this->meta['tone'] ?? 'info',
                        details: is_array($this->meta['details'] ?? null) ? $this->meta['details'] : [],
                        actionUrl: $this->meta['action_url'] ?? null,
                        actionText: $this->meta['action_text'] ?? 'Lihat Detail Laporan',
                    ));
                }
            } catch (\Throwable $e) {
                Log::warning('LoFound email notification skipped/failed', [
                    'email' => $this->email,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($this->phone) {
            $token = config('services.whatsapp.token');
            $url = config('services.whatsapp.url');

            if ($token && $url) {
                try {
                    Http::timeout(8)
                        ->withHeaders(['Authorization' => $token])
                        ->post($url, [
                            'target'  => $this->phone,
                            'message' => "*{$this->title}*\n{$this->body}\n\n_LoFound - KAI Commuter_",
                        ]);
                } catch (\Throwable $e) {
                    Log::warning('LoFound WhatsApp gateway failed', [
                        'phone' => $this->phone,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }
    }
}
