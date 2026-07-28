/**
 * PATCH /api/merchant/orders/[id]/status
 *
 * Merchant update status order. Allowed transitions:
 *   PENDING → ACCEPTED | CANCELLED  (accept or reject)
 *   ACCEPTED → PREPARING
 *   PREPARING → READY
 *
 * Body: { status: "ACCEPTED" | "PREPARING" | "READY" | "CANCELLED", reason? }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { emitOrderStatusChange } from "@/lib/realtime/realtime-client";
import { OrderStatus } from "@prisma/client";

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: [], // READY → waiting driver, merchant tidak bisa ubah lagi
  PICKED_UP: [],
  DELIVERED: [],
  CANCELLED: [],
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireRole("MERCHANT");
  if (!me) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const meta = getRequestMeta(req);
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.status) {
    return NextResponse.json({ error: "status wajib diisi." }, { status: 400 });
  }

  const newStatus = body.status as OrderStatus;
  if (!Object.values(OrderStatus).includes(newStatus)) {
    return NextResponse.json({ error: "status tidak valid." }, { status: 400 });
  }

  const merchant = await db.merchant.findUnique({ where: { userId: me.id } });
  if (!merchant) {
    return NextResponse.json({ error: "Profil merchant tidak ditemukan." }, { status: 404 });
  }

  const order = await db.order.findFirst({
    where: { id, merchantId: merchant.id },
    include: { items: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  }

  // Cek transisi valid
  const allowed = ALLOWED_TRANSITIONS[order.status];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Transisi ${order.status} → ${newStatus} tidak diizinkan.` },
      { status: 400 },
    );
  }

  // Update + set timestamp sesuai status
  const updateData: Record<string, unknown> = { status: newStatus };
  const now = new Date();
  if (newStatus === "ACCEPTED") updateData.acceptedAt = now;
  else if (newStatus === "READY") updateData.readyAt = now;
  else if (newStatus === "CANCELLED") {
    updateData.cancelledAt = now;
    if (body.reason) updateData.notes = (order.notes ?? "") + `\n[CANCELLED: ${String(body.reason).slice(0, 200)}]`;
  }

  const updated = await db.order.update({
    where: { id: order.id },
    data: updateData,
  });

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "order",
    action: "order.status_change",
    description: `Order ${order.code}: ${order.status} → ${newStatus}.`,
    targetId: order.id,
    targetType: "order",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      code: order.code,
      from: order.status,
      to: newStatus,
      ...(body.reason && { reason: String(body.reason).slice(0, 200) }),
    },
  });

  // 🔔 Realtime: notify customer + admin (+drivers if READY)
  // Fetch customer userId + merchant userId for room targeting
  const orderWithUsers = await db.order.findUnique({
    where: { id: order.id },
    select: {
      customer: { select: { userId: true } },
      merchant: { select: { userId: true } },
      driver: { select: { userId: true } },
    },
  });
  if (orderWithUsers) {
    await emitOrderStatusChange({
      orderId: order.id,
      code: order.code,
      from: order.status,
      to: newStatus,
      customerUserId: orderWithUsers.customer.userId,
      merchantUserId: orderWithUsers.merchant.userId,
      driverUserId: orderWithUsers.driver?.userId ?? null,
      actorRole: "MERCHANT",
    });
  }

  return NextResponse.json({
    order: {
      id: updated.id,
      code: updated.code,
      status: updated.status,
      acceptedAt: updated.acceptedAt?.toISOString() ?? null,
      readyAt: updated.readyAt?.toISOString() ?? null,
      cancelledAt: updated.cancelledAt?.toISOString() ?? null,
    },
  });
}
