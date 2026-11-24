<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kode Verifikasi Email - LoFound</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#18364a;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f8fa;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="540" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:540px;background-color:#ffffff;border:1px solid #d5e8f0;border-radius:12px;overflow:hidden;">
          <!-- Brand Header -->
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
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:28px 32px 24px 32px;">
              <h1 style="margin:0 0 10px 0;font-size:20px;font-weight:700;color:#18364a;line-height:1.3;">
                Kode Verifikasi Email
              </h1>
              <p style="margin:0 0 22px 0;font-size:14px;line-height:1.6;color:#4a5d6a;">
                Masukkan 6 digit kode verifikasi berikut untuk melanjutkan proses autentikasi akun <strong style="color:#18364a;">{{ $recipientEmail }}</strong> di LoFound.
              </p>

              <!-- Code Box (GitHub-style card) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f8fa;border:1px solid #d5e8f0;border-radius:10px;">
                <tr>
                  <td align="center" style="padding:22px 20px;">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#6b7c88;margin-bottom:12px;">
                      KODE DIMINTA
                    </div>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                      <tr>
                        <td style="background-color:#ffffff;border:1px solid #d5e8f0;border-radius:8px;padding:12px 22px;text-align:center;">
                          <span style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,Courier,monospace;font-size:32px;font-weight:800;letter-spacing:8px;padding-left:8px;color:#18364a;line-height:1.2;">{{ $code }}</span>
                        </td>
                      </tr>
                    </table>
                    <div style="font-size:12px;color:#6b7c88;margin-top:12px;">
                      Berlaku selama <strong style="color:#26799b;">{{ $expiresMinutes }} menit</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background-color:#ebf5f9;border-radius:8px;">
                <tr>
                  <td style="padding:12px 16px;font-size:12px;line-height:1.55;color:#26799b;">
                    <strong>Keamanan Akun:</strong> Jangan pernah membagikan kode ini kepada siapa pun, termasuk pihak yang mengaku sebagai petugas. Abaikan email ini jika Anda tidak meminta kode verifikasi.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px 24px 32px;border-top:1px solid #ebf5f9;background-color:#fafcfd;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8c9ba5;">
                Email ini dikirim otomatis oleh sistem <strong>LoFound — Layanan Barang Hilang &amp; Temuan KAI Commuter</strong>. Mohon tidak membalas email ini.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
