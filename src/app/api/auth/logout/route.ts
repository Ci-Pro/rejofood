/**
 * POST /api/auth/logout
 * Deletes the session row + clears the cookie. Always returns 200.
 * Mencatat event ke AuditLog jika ada user yang sedang login.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clearSessionCookie, getTokenFromCookies } from "@/lib/auth/session";
import { logAction, getRequestMeta } from "@/lib/auth/audit";

export async function POST(req: Request) {
  const meta = getRequestMeta(req);
  try {
    const token = await getTokenFromCookies();
    if (token) {
      // Cari session + user untuk audit log
      const session = await db.session.findUnique({
        where: { token },
        include: { user: true },
      });
      if (session?.user) {
        await logAction({
          actorId: session.user.id,
          actorEmail: session.user.email,
          actorRole: session.user.role,
          category: "auth",
          action: "auth.logout",
          description: `Logout: ${session.user.email}.`,
          outcome: "success",
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });
      }
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
