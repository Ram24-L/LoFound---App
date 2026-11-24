@php
  $toneStyles = match ($tone) {
      'success' => ['bg' => '#ecfdf5', 'text' => '#15803d', 'border' => '#bbf7d0'],
      'warning' => ['bg' => '#fef6e4', 'text' => '#b7791f', 'border' => '#fde68a'],
      'danger'  => ['bg' => '#fdeeee', 'text' => '#d64545', 'border' => '#fecaca'],
      default   => ['bg' => '#ebf5f9', 'text' => '#26799b', 'border' => '#bae6fd'],
  };

  $rows = [];
  if ($reportCode) {
      $rows['Kode Laporan'] = '#' . $reportCode;
  }
  if ($itemName) {
      $rows['Barang'] = $itemName;
  }
  if ($routeLabel) {
      $rows['Rute / Stasiun'] = $routeLabel;
  }
  if ($statusLabel) {
      $rows['Status Terkini'] = $statusLabel;
  }
  foreach ($details as $label => $value) {
      if ($value !== null && $value !== '') {
          $rows[(string) $label] = (string) $value;
      }
  }
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ $title }} - LoFound</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#18364a;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f8fa;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="540" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:540px;background-color:#ffffff;border:1px solid #d5e8f0;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 32px 18px 32px;border-bottom:1px solid #ebf5f9;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color:#318fb5;color:#ffffff;font-weight:800;font-size:14px;line-height:14px;padding:8px 10px;border-radius:8px;letter-spacing:-0.3px;">
                          LF
                        </td>
                        <td style="padding-left:10px;">
                          <div style="font-size:16px;font-weight:800;color:#18364a;line-height:1.2;">LoFound</div>
                          <div style="font-size:11px;font-weight:600;color:#6b7c88;line-height:1.2;">KAI Commuter &middot; Lost &amp; Found</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  @if($reportCode)
                    <td align="right" valign="middle">
                      <span style="display:inline-block;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,Courier,monospace;font-size:12px;font-weight:700;color:#26799b;background-color:#ebf5f9;border:1px solid #d5e8f0;border-radius:999px;padding:4px 10px;">
                        #{{ $reportCode }}
                      </span>
                    </td>
                  @endif
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 24px 32px;">
              @if($statusLabel)
                <div style="margin-bottom:14px;">
                  <span style="display:inline-block;font-size:12px;font-weight:700;background-color:{{ $toneStyles['bg'] }};color:{{ $toneStyles['text'] }};border:1px solid {{ $toneStyles['border'] }};border-radius:999px;padding:4px 12px;">
                    {{ $statusLabel }}
                  </span>
                </div>
              @endif

              <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#18364a;line-height:1.35;">
                {{ $title }}
              </h1>

              <p style="margin:0 0 10px 0;font-size:14px;line-height:1.6;color:#18364a;">
                Halo <strong>{{ $recipientName ?? 'Penumpang' }}</strong>,
              </p>

              <p style="margin:0 0 22px 0;font-size:14px;line-height:1.65;color:#4a5d6a;">
                {{ $body }}
              </p>

              @if(count($rows) > 0)
                <!-- Summary Table -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f8fa;border:1px solid #d5e8f0;border-radius:10px;border-collapse:separate;overflow:hidden;margin-bottom:24px;">
                  @foreach($rows as $label => $value)
                    <tr>
                      <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#6b7c88;width:38%;vertical-align:top;{{ !$loop->last ? 'border-bottom:1px solid #e6eff4;' : '' }}">
                        {{ $label }}
                      </td>
                      <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#18364a;vertical-align:top;{{ !$loop->last ? 'border-bottom:1px solid #e6eff4;' : '' }}">
                        {{ $value }}
                      </td>
                    </tr>
                  @endforeach
                </table>
              @endif

              @if($actionUrl)
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="border-radius:8px;background-color:#318fb5;">
                      <a href="{{ $actionUrl }}" target="_blank" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                        {{ $actionText }}
                      </a>
                    </td>
                  </tr>
                </table>
              @endif
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px 24px 32px;border-top:1px solid #ebf5f9;background-color:#fafcfd;">
              <p style="margin:0;font-size:12px;line-height:1.55;color:#8c9ba5;">
                Notifikasi ini dikirim karena pengingat email diaktifkan pada laporan kehilangan Anda di <strong>LoFound &mdash; KAI Commuter</strong>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
