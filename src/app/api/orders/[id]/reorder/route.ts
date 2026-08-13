/**
 * POST /api/orders/[id]/reorder
 *
 * Customer re-order dari order DELIVERED/CANCELLED sebelumnya.
 * Buat order baru dengan same items (jika masih available) + same merchant.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { emitOrderCreated } from "@/lib/realtime/realtime-client";
import { OrderStatus } from "@prisma/client";

const DELIVERY_FEE = 10000;

function generateOrderCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "RF-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

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

  const customer = await db.customer.findUnique({ where: { userId: me.id } });
  if (!customer) {
    return NextResponse.json({ error: "Profil customer tidak ditemukan." }, { status: 404 });
  }

  // Find original order with ownership check
  const original = await db.order.findFirst({
    where: { id, customerId: customer.id },
    include: {
      items: true,
      merchant: { select: { userId: true, restaurantName: true, isOpen: true } },
    },
  });
  if (!original) {
    return NextResponse.json({ error: "Order asli tidak ditemukan." }, { status: 404 });
  }

  if (original.status !== "DELIVERED" && original.status !== "CANCELLED") {
    return NextResponse.json(
      { error: "Hanya bisa re-order dari pesanan yang sudah selesai atau dibatalkan." },
      { status: 400 },
    );
  }

  if (!original.merchant.isOpen) {
    return NextResponse.json(
      { error: `${original.merchant.restaurantName} sedang tutup. Coba lagi nanti.` },
      { status: 400 },
    );
  }

  // Verify all menu items still exist and are available
  const menuItemIds = original.items.map((i) => i.menuItemId);
  const menuItems = await db.menuItem.findMany({
    where: { id: { in: menuItemIds } },
  });

  const unavailable = original.items.filter(
    (oi) => {
      const mi = menuItems.find((m) => m.id === oi.menuItemId);
      return !mi || !mi.isAvailable;
    },
  );

  if (unavailable.length > 0) {
    return NextResponse.json(
      {
        error: `Beberapa item tidak lagi tersedia: ${unavailable.map((i) => i.name).join(", ")}. Silakan pesan ulang manual.`,
      },
      { status: 400 },
    );
  }

  // Build order items (snapshot current prices)
  const orderItems = original.items.map((oi) => {
    const mi = menuItems.find((m) => m.id === oi.menuItemId)!;
    return {
      menuItemId: mi.id,
      name: mi.name, // refresh to current name
      price: mi.price, // refresh to current price
      quantity: oi.quantity,
      subtotal: mi.price * oi.quantity,
    };
  });

  const subtotal = orderItems.reduce((sum, oi) => sum + oi.subtotal, 0);
  const total = subtotal + DELIVERY_FEE;

  let code = generateOrderCode();
  for (let i = 0; i < 5; i++) {
    const existing = await db.order.findUnique({ where: { code } });
    if (!existing) break;
    code = generateOrderCode();
  }

  const order = await db.order.create({
    data: {
      code,
      customerId: customer.id,
      merchantId: original.merchantId,
      status: OrderStatus.PENDING,
      subtotal,
      deliveryFee: DELIVERY_FEE,
      total,
      deliveryAddress: original.deliveryAddress,
      notes: original.notes ? `[Re-order dari ${original.code}] ${original.notes}` : `[Re-order dari ${original.code}]`,
      items: { create: orderItems },
    },
    include: {
      items: true,
      merchant: { select: { restaurantName: true } },
    },
  });

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "order",
    action: "order.reorder",
    description: `Re-order ${order.code} dibuat dari ${original.code}. Total Rp ${total.toLocaleString("id-ID")}.`,
    targetId: order.id,
    targetType: "order",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      code: order.code,
      originalCode: original.code,
      merchantName: order.merchant.restaurantName,
      total,
      itemCount: orderItems.length,
    },
  });

  await emitOrderCreated({
    orderId: order.id,
    code: order.code,
    merchantUserId: original.merchant.userId,
    customerName: me.fullName,
    total,
    status: "PENDING",
    itemCount: orderItems.reduce((s, i) => s + i.quantity, 0),
  });

  return NextResponse.json({
    order: {
      id: order.id,
      code: order.code,
      status: order.status,
      total: order.total,
    },
  }, { status: 201 });
}
