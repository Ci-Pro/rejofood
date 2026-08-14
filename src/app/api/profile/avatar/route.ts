/**
 * PATCH /api/profile/avatar
 * Update user avatar URL.
 * Body: { avatarUrl: string | null }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";

export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.avatarUrl !== "string") {
    return NextResponse.json({ error: "avatarUrl wajib diisi." }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: me.id },
    data: { avatarUrl: body.avatarUrl || null },
  });

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "auth",
    action: "profile.avatar_update",
    description: `Avatar diperbarui oleh ${me.email}.`,
    targetId: me.id,
    targetType: "user",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      avatarUrl: updated.avatarUrl,
    },
  });
}
