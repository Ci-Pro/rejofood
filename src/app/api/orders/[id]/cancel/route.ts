/**
 * POST /api/orders/[id]/cancel
 *
 * Customer cancel order. Allowed dari status:
 *  - PENDING     → CANCELLED  (sebelum merchant accept)
 *  - ACCEPTED    → CANCELLED  (setelah accept, sebelum preparing)
 *  - PREPARING   → CANCELLED  (merchant sudah mulai proses, tapi masih bisa cancel)
 *
 * TIDAK bisa cancel:
 *  - READY       → sudah siap, harusnya tidak cancel (pending dispute)
 *  - PICKED_UP   → driver sudah ambil, tidak bisa cancel
 *  - DELIVERED   → sudah selesai
 *  - CANCELLED   → sudah cancel
 *
 * Body: { reason?: string }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { emitOrderStatusChange } from "@/lib/realtime/realtime-client";
import { OrderStatus } from "@prisma/client";

const CANCELLABLE_STATUSES: OrderStatus[] = ["PENDING", "ACCEPTED", "PREPARING"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireRole("CUSTOMER");
  if (!me) {
    return NextResponse.json({ error: "Forbidden. Hanya customer." }, { status: 403 });
  }

  const meta = getRequestMeta(req);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = body?.reason ? String(body.reason).trim().slice(0, 300) : null;

  // Cari customer profile
  const customer = await db.customer.findUnique({ where: { userId: me.id } });
  if (!customer) {
    return NextResponse.json({ error: "Profil customer tidak ditemukan." }, { status: 404 });
  }

  // Cari order dengan ownership check
  const order = await db.order.findFirst({
    where: { id, customerId: customer.id },
    include: {
      merchant: { select: { userId: true, restaurantName: true } },
      driver: { select: { userId: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  }

  // Validasi status bisa di-cancel
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    const msgMap: Record<string, string> = {
      READY: "Order sudah siap dijemput. Tidak bisa dibatalkan — hubungi restoran langsung.",
      PICKED_UP: "Driver sudah mengambil order. Tidak bisa dibatalkan.",
      DELIVERED: "Order sudah selesai. Tidak bisa dibatalkan.",
      CANCELLED: "Order sudah dibatalkan sebelumnya.",
    };
    return NextResponse.json(
      { error: msgMap[order.status] || `Status ${order.status} tidak bisa di-cancel.` },
      { status: 400 },
    );
  }

  const now = new Date();
  const notes = reason
    ? `${order.notes ?? ""}\n[CANCELLED oleh customer: ${reason}]`.trim()
    : order.notes ?? null;

  const updated = await db.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.CANCELLED,
      cancelledAt: now,
      notes,
    },
  });

  // Audit log
  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "order",
    action: "order.cancel",
    description: `Order ${order.code}: ${order.status} → CANCELLED oleh customer${reason ? ` (${reason})` : ""}.`,
    targetId: order.id,
    targetType: "order",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      code: order.code,
      from: order.status,
      to: "CANCELLED",
      reason: reason ?? null,
      merchantName: order.merchant.restaurantName,
    },
  });

  // 🔔 Realtime: notify merchant + admin (+driver jika sudah assigned)
  await emitOrderStatusChange({
    orderId: order.id,
    code: order.code,
    from: order.status,
    to: "CANCELLED",
    customerUserId: me.id,
    merchantUserId: order.merchant.userId,
    driverUserId: order.driver?.userId ?? null,
    actorRole: "CUSTOMER",
  });

  return NextResponse.json({
    order: {
      id: updated.id,
      code: updated.code,
      status: updated.status,
      cancelledAt: updated.cancelledAt?.toISOString(),
    },
  });
}
