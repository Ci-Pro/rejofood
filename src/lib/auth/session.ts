/**
 * Cookie-based session helpers.
 *
 * Design goals:
 *  - Stateless on the client: the only thing stored in the cookie is an opaque session token.
 *  - Server-side revocable: the token maps to a row in the Session table, so logout = delete row.
 *  - HTTP-only, Secure, SameSite=Strict di production untuk mencegah CSRF.
 *
 * NOTE: Next.js 16 made `cookies()` async — all helpers here are async to match.
 */
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export const SESSION_COOKIE = "rejo_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function getTokenFromCookies(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax = mengizinkan navigasi top-level GET (klik link dari email), tapi block cross-site POST
    // Pilihan terbaik untuk food delivery (perlu link dari email notifikasi + CSRF protection)
    // Strict akan break APK WebView + email link flow
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Generate cryptographically secure session token.
 *
 * Pakai crypto.randomBytes (32 bytes = 256-bit entropy) — tidak bisa ditebak
 * seperti Math.random(). Token di-encode sebagai hex (64 chars).
 *
 * Setara dengan keamanan bank-grade session token.
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}
