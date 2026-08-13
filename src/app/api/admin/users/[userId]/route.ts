/**
 * PATCH /api/admin/users/[userId]
 * Admin activate/deactivate user (ban/unban).
 * Body: { isActive: boolean }
 *
 * Deactivated user cannot login (session check rejects isActive=false).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const meta = getRequestMeta(req);
  const { userId } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive (boolean) wajib diisi." }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
  }

  // Prevent admin from banning themselves
  if (target.id === admin.id) {
    return NextResponse.json({ error: "Tidak bisa menonaktifkan akun sendiri." }, { status: 400 });
  }

  // Prevent banning other admins (require super-admin flow in future)
  if (target.role === "ADMIN" && !body.isActive) {
    return NextResponse.json({ error: "Tidak bisa menonaktifkan admin lain. Hubungi super-admin." }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { isActive: body.isActive },
  });

  // If deactivating, revoke all sessions
  if (!body.isActive) {
    await db.session.deleteMany({ where: { userId } });
  }

  await logAction({
    actorId: admin.id,
    actorEmail: admin.email,
    actorRole: admin.role,
    category: "admin",
    action: body.isActive ? "admin.user.activate" : "admin.user.ban",
    description: `Admin ${admin.email} ${body.isActive ? "mengaktifkan" : "menonaktifkan"} user ${target.email} (${target.role}).`,
    targetId: target.id,
    targetType: "user",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      targetEmail: target.email,
      targetRole: target.role,
      isActive: body.isActive,
      sessionsRevoked: !body.isActive,
    },
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role,
      isActive: updated.isActive,
    },
  });
}
