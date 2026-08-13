/**
 * PATCH /api/driver/status
 * Toggle driver isOnline (true/false).
 * Body: { isOnline: boolean }
 *
 * Driver offline = tidak lihat available orders (kecuali yang sudah di-assign).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";

export async function PATCH(req: Request) {
  const me = await requireRole("DRIVER");
  if (!me) {
    return NextResponse.json({ error: "Forbidden. Hanya driver." }, { status: 403 });
  }

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.isOnline !== "boolean") {
    return NextResponse.json({ error: "isOnline (boolean) wajib diisi." }, { status: 400 });
  }

  const driver = await db.driver.findUnique({ where: { userId: me.id } });
  if (!driver) {
    return NextResponse.json({ error: "Profil driver tidak ditemukan." }, { status: 404 });
  }

  const updated = await db.driver.update({
    where: { id: driver.id },
    data: { isOnline: body.isOnline },
  });

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "driver",
    action: "driver.status_change",
    description: `Driver ${me.fullName} ${body.isOnline ? "ONLINE" : "OFFLINE"}.`,
    targetId: driver.id,
    targetType: "driver",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { isOnline: body.isOnline },
  });

  return NextResponse.json({ isOnline: updated.isOnline });
}
