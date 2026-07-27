/**
 * POST /api/auth/logout
 * Deletes the session row + clears the cookie. Always returns 200.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clearSessionCookie, getTokenFromCookies } from "@/lib/auth/session";

export async function POST() {
  try {
    const token = await getTokenFromCookies();
    if (token) {
      await db.session.deleteMany({ where: { token } }).catch(() => {});
    }
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[logout] error", err);
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  }
}
