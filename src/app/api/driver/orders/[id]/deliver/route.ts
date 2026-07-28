/**
 * POST /api/driver/orders/[id]/deliver
 *
 * Driver mark order as delivered: PICKED_UP → DELIVERED.
 * Hanya driver yang sudah assign ke order ini yang bisa complete.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireRole("DRIVER");
  if (!me) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const meta = getRequestMeta(req);
  const { id } = await params;

  const driver = await db.driver.findUnique({ where: { userId: me.id } });
  if (!driver) {
    return NextResponse.json({ error: "Profil driver tidak ditemukan." }, { status: 404 });
  }

  // Verify ownership
  const order = await db.order.findFirst({
    where: { id, driverId: driver.id },
  });
  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan atau bukan milik Anda." }, { status: 404 });
  }
  if (order.status !== "PICKED_UP") {
    return NextResponse.json({ error: `Order status saat ini: ${order.status}. Harus PICKED_UP untuk deliver.` }, { status: 400 });
  }

  const updated = await db.order.update({
    where: { id },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "order",
    action: "order.status_change",
    description: `Order ${order.code}: PICKED_UP → DELIVERED oleh ${me.fullName}.`,
    targetId: order.id,
    targetType: "order",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { code: order.code, from: "PICKED_UP", to: "DELIVERED" },
  });

  return NextResponse.json({
    order: {
      id: updated.id,
      code: updated.code,
      status: updated.status,
      deliveredAt: updated.deliveredAt?.toISOString(),
    },
  });
}
