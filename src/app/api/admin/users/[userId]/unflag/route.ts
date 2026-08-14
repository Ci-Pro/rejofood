/**
 * POST /api/admin/users/[userId]/unflag
 *
 * Admin: unflag user yang di-flag otomatis oleh suspicious activity detection.
 * Setelah unflag, user bisa login kembali.
 *
 * Body: { reason?: string } — alasan unflag (untuk audit log)
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { unflagUser } from "@/lib/auth/suspicious-activity";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden. Admin only." }, { status: 403 });
  }

  const meta = getRequestMeta(req);
  const { userId } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = body?.reason ? String(body.reason).trim().slice(0, 300) : "Manual unflag by admin";

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, isFlagged: true, flagReason: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
  }
  if (!target.isFlagged) {
    return NextResponse.json({ error: "User tidak sedang di-flag." }, { status: 400 });
  }

  await unflagUser(admin.id, admin.email, userId, meta.ipAddress);

  await logAction({
    actorId: admin.id,
    actorEmail: admin.email,
    actorRole: admin.role,
    category: "security",
    action: "security.user_unflagged",
    description: `User ${target.email} di-unflag oleh admin. Reason: ${reason}. Previous flag: ${target.flagReason ?? "unknown"}.`,
    targetId: userId,
    targetType: "user",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { reason, previousFlagReason: target.flagReason },
  });

  return NextResponse.json({ ok: true, message: "User berhasil di-unflag." });
}
