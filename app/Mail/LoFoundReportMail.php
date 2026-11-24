<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class LoFoundReportMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  array<string, string>  $details
     */
    public function __construct(
        public string $title,
        public string $body,
        public ?string $recipientName = null,
        public ?string $reportCode = null,
        public ?string $itemName = null,
        public ?string $routeLabel = null,
        public ?string $statusLabel = null,
        public string $tone = 'info',
        public array $details = [],
        public ?string $actionUrl = null,
        public string $actionText = 'Lihat Detail Laporan',
    ) {}

    public function envelope(): Envelope
    {
        $suffix = $this->reportCode ? " (#{$this->reportCode})" : '';

        return new Envelope(
            subject: "[LoFound] {$this->title}{$suffix}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.report-notification',
            text: 'emails.report-notification-text',
        );
    }
}
