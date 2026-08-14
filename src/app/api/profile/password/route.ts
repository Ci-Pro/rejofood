/**
 * PATCH /api/profile/password
 *
 * Change password. Requires current password verification.
 * Body: { currentPassword, newPassword }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { validatePassword } from "@/lib/auth/password-policy";
import { Role } from "@prisma/client";

export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body?.currentPassword || !body?.newPassword) {
    return NextResponse.json({ error: "Password lama dan baru wajib diisi." }, { status: 400 });
  }

  // Fetch user with passwordHash
  const user = await db.user.findUnique({ where: { id: me.id } });
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
  }

  // Verify current password
  if (!verifyPassword(body.currentPassword, user.passwordHash)) {
    await logAction({
      actorId: me.id,
      actorEmail: me.email,
      actorRole: me.role as Role,
      category: "auth",
      action: "profile.password_failed",
      description: `Upaya ganti password gagal (password lama salah) untuk ${me.email}.`,
      outcome: "failure",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return NextResponse.json({ error: "Password lama salah." }, { status: 401 });
  }

  // Validate new password with strict policy
  const pwdCheck = validatePassword(body.newPassword);
  if (!pwdCheck.valid) {
    return NextResponse.json(
      { error: pwdCheck.errors.join(" ") },
      { status: 400 },
    );
  }

  if (body.currentPassword === body.newPassword) {
    return NextResponse.json({ error: "Password baru tidak boleh sama dengan password lama." }, { status: 400 });
  }

  // Update
  const newHash = hashPassword(body.newPassword);
  await db.user.update({
    where: { id: me.id },
    data: { passwordHash: newHash },
  });

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role as Role,
    category: "auth",
    action: "profile.password_changed",
    description: `Password berhasil diubah oleh ${me.email}.`,
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true });
}
