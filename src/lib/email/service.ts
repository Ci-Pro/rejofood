/**
 * Email service — kirim email transaksional via Resend SMTP.
 *
 * Resend (resend.com) menyediakan 3.000 email gratis per bulan (100/hari).
 * Daftar di https://resend.com → dapatkan API key → set RESEND_API_KEY di env.
 *
 * Untuk development tanpa Resend: email tidak dikirim, hanya di-log ke console.
 * Production: wajib set RESEND_API_KEY + RESEND_FROM_EMAIL.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "RejoFood <no-reply@rejofood.id>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.REJOFOOD_BACKEND_URL || "https://rejofood.vercel.app";

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Kirim email via Resend API.
 * Jika RESEND_API_KEY tidak diset, log ke console (dev mode).
 */
export async function sendEmail(params: EmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isEmailConfigured()) {
    console.log("\n[DEV EMAIL] ------------------");
    console.log(`To: ${params.to}`);
    console.log(`Subject: ${params.subject}`);
    console.log(`Body: ${params.text || "(HTML only)"}`);
    console.log("-----------------------------------\n");
    return { success: true, messageId: `dev-${Date.now()}` };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      console.error("[email] Resend API error:", res.status, errText);
      return { success: false, error: `Resend API ${res.status}: ${errText}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.id };
  } catch (err) {
    console.error("[email] send failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Generate verification token (cryptographically secure, 32 bytes hex).
 */
export function generateVerificationToken(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomBytes } = require("crypto");
  return randomBytes(32).toString("hex");
}

/**
 * Hash token untuk disimpan di DB (tidak simpan token asli).
 * Pakai SHA-256 — cukup untuk token verification (bukan password).
 */
export function hashToken(token: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("crypto");
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Kirim email verification setelah user register.
 */
export async function sendVerificationEmail(
  email: string,
  fullName: string,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,#003F3F 0%,#1A5757 100%);padding:32px 24px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">RejoFood</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Pesan, Masak, Antar, Atur</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 24px;">
            <h2 style="margin:0 0 16px;color:#1A1426;font-size:18px;">Halo ${escapeHtml(fullName)},</h2>
            <p style="margin:0 0 16px;color:#4A4458;font-size:14px;line-height:1.6;">
              Terima kasih telah mendaftar di RejoFood. Untuk mengaktifkan akun Anda,
              silakan verifikasi email dengan mengklik tombol di bawah:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr><td align="center">
                <a href="${verifyUrl}" style="display:inline-block;background:#003F3F;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:14px;">
                  Verifikasi Email Saya
                </a>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;color:#4A4458;font-size:14px;line-height:1.6;">Atau salin link ini ke browser:</p>
            <p style="margin:0 0 16px;color:#003F3F;font-size:12px;word-break:break-all;">${verifyUrl}</p>
            <div style="background:#FFF8EE;border-left:3px solid #FF6B22;padding:12px 16px;border-radius:8px;margin:16px 0;">
              <p style="margin:0;color:#8B6914;font-size:12px;line-height:1.5;">
                Link ini berlaku 24 jam. Jika tidak verifikasi dalam waktu tersebut,
                Anda perlu meminta link verifikasi baru.
              </p>
            </div>
            <p style="margin:0;color:#4A4458;font-size:14px;line-height:1.6;">
              Jika Anda tidak mendaftar di RejoFood, abaikan email ini.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f7fd;padding:20px 24px;border-top:1px solid #ece8f5;">
            <p style="margin:0;color:#8B85A0;font-size:11px;text-align:center;line-height:1.5;">
              (c) ${new Date().getFullYear()} RejoFood - Email ini dikirim otomatis, jangan balas.<br>
              Untuk bantuan: support@rejofood.id
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  const text = `RejoFood - Verifikasi Email

Halo ${fullName},

Terima kasih telah mendaftar di RejoFood. Untuk mengaktifkan akun Anda, silakan verifikasi email dengan mengklik link berikut:

${verifyUrl}

Link ini berlaku 24 jam.

Jika Anda tidak mendaftar di RejoFood, abaikan email ini.

(c) ${new Date().getFullYear()} RejoFood`;

  return sendEmail({
    to: email,
    subject: "Verifikasi Email Anda - RejoFood",
    html,
    text,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
