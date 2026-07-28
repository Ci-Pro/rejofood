/**
 * POST /api/driver/orders/[id]/pickup
 *
 * Driver pick up order READY → assign self + status → PICKED_UP.
 * Race condition handled: gunakan updateMany dengan where status=READY + driverId=null.
 * Jika 0 row updated, berarti order sudah diambil driver lain.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { emitOrderStatusChange } from "@/lib/realtime/realtime-client";

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

  // Atomic claim: update where status=READY AND driverId=null
  const now = new Date();
  const result = await db.order.updateMany({
    where: { id, status: "READY", driverId: null },
    data: { driverId: driver.id, status: "PICKED_UP", pickedUpAt: now },
  });

  if (result.count === 0) {
    // Cek apakah order ada tapi sudah diambil
    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
    }
    if (order.status !== "READY") {
      return NextResponse.json({ error: `Order sudah tidak available (status: ${order.status}).` }, { status: 409 });
    }
    if (order.driverId !== null) {
      return NextResponse.json({ error: "Order sudah diambil driver lain." }, { status: 409 });
    }
    return NextResponse.json({ error: "Gagal mengambil order." }, { status: 500 });
  }

  const updated = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      merchant: { select: { restaurantName: true, userId: true } },
      customer: { select: { userId: true } },
    },
  });

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "order",
    action: "order.status_change",
    description: `Order ${updated!.code}: READY → PICKED_UP oleh driver ${me.fullName}.`,
    targetId: updated!.id,
    targetType: "order",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      code: updated!.code,
      from: "READY",
      to: "PICKED_UP",
      driverId: driver.id,
    },
  });

  // 🔔 Realtime: notify customer + merchant + admin
  await emitOrderStatusChange({
    orderId: updated!.id,
    code: updated!.code,
    from: "READY",
    to: "PICKED_UP",
    customerUserId: updated!.customer.userId,
    merchantUserId: updated!.merchant.userId,
    driverUserId: driver.userId,
    actorRole: "DRIVER",
  });

  return NextResponse.json({
    order: {
      id: updated!.id,
      code: updated!.code,
      status: updated!.status,
      pickedUpAt: updated!.pickedUpAt?.toISOString() ?? null,
    },
  });
}
