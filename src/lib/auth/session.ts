/**
 * Cookie-based session helpers.
 *
 * Design goals (foundation):
 *  - Stateless on the client: the only thing stored in the cookie is an opaque session token.
 *  - Server-side revocable: the token maps to a row in the Session table, so logout = delete row.
 *  - HTTP-only, Secure, SameSite=Lax to survive the sandbox preview iframe while staying safe.
 *
 * NOTE: For production behind a real domain, switch SameSite to "Strict" and ensure HTTPS.
 *
 * NOTE: Next.js 16 made `cookies()` async — all helpers here are async to match.
 */
import { cookies } from "next/headers";

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
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Generate a reasonably-unique opaque token. Not cryptographically fancy — swap for a JWT later if needed. */
export function generateToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
