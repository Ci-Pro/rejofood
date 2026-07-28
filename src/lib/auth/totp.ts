/**
 * TOTP utility — RFC 6238 Time-based One-Time Password.
 *
 * Dipakai untuk 2FA admin (wajib) dan opsional role lain di masa depan.
 *
 * Catatan keamanan:
 *  - Window toleransi ±30 detik (epochTolerance=30) untuk clock skew device.
 *  - Di production: secret sebaiknya dienkripsi saat disimpan (AES-GCM dengan KMS).
 *    Untuk fondasi ini, secret disimpan plaintext di SQLite — sudah dicatat di TODO.
 */
import {
  generateSecret as totpGenerateSecret,
  generateSync as totpGenerateSync,
  generateURI as totpGenerateURI,
  verifySync as totpVerifySync,
} from "otplib";

export const TOTP_ISSUER = "RejoFood";
const STEP = 30;            // 30 detik per token
const DIGITS = 6;
const TOLERANCE_SEC = 30;   // ±30 detik untuk clock skew

/** Generate secret base32 baru (20 bytes entropy). */
export function generateSecret(): string {
  return totpGenerateSecret();
}

/**
 * Bangun URL otpauth:// yang akan di-encode ke QR code.
 * Format: otpauth://totp/RejoFood:email?secret=...&issuer=RejoFood
 */
export function buildOtpAuthUrl(email: string, secret: string): string {
  return totpGenerateURI({
    secret,
    label: email,
    issuer: TOTP_ISSUER,
    type: "totp",
    algorithm: "sha1",
    digits: DIGITS,
    period: STEP,
  });
}

/** Verifikasi token 6-digit. Toleransi ±30 detik untuk clock skew. */
export function verifyToken(token: string, secret: string): boolean {
  const cleaned = token.replace(/\s+/g, "").trim();
  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    const result = totpVerifySync({
      secret,
      token: cleaned,
      digits: DIGITS,
      period: STEP,
      algorithm: "sha1",
      epochTolerance: TOLERANCE_SEC,
    });
    // verifySync mengembalikan object { valid: boolean } atau boolean tergantung versi
    if (typeof result === "boolean") return result;
    if (typeof result === "object" && result !== null && "valid" in result) {
      return Boolean((result as { valid: unknown }).valid);
    }
    return Boolean(result);
  } catch (err) {
    console.error("[totp] verifyToken error", err);
    return false;
  }
}

/** Untuk testing/debug: generate token saat ini (JANGAN dipakai di production). */
export function _generateTokenForTesting(secret: string): string {
  return totpGenerateSync({
    secret,
    digits: DIGITS,
    period: STEP,
    algorithm: "sha1",
  });
}
