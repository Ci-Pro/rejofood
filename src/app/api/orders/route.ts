/**
 * POST /api/orders
 * Checkout: customer place order dari cart.
 * Body: { items: [{ menuItemId, quantity }], deliveryAddress, notes? }
 *
 * Server-side validation:
 *  - Customer harus login
 *  - Semua item harus dari merchant yang sama
 *  - Item harus available
 *  - Snapshot name + price ke OrderItem (untuk history konsisten)
 *
 * GET /api/orders
 * List pesanan customer yang sedang login (semua status).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { rateLimitResponse } from "@/lib/auth/api-rate-limiter";
import { emitOrderCreated } from "@/lib/realtime/realtime-client";
import { sendNewOrderPush } from "@/lib/push";
import { estimateDeliveryFee } from "@/lib/delivery-fee";
import { OrderStatus } from "@prisma/client";

function generateOrderCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars (0/O, 1/I)
  let code = "RF-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function POST(req: Request) {
  // 🔒 Rate limit: 10 order per menit per IP (anti spam order)
  const limited = rateLimitResponse(req, "orders:create", 10, 60_000);
  if (limited) return limited;

  const me = await requireRole("CUSTOMER");
  if (!me) {
    return NextResponse.json({ error: "Forbidden. Hanya customer." }, { status: 403 });
  }

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Keranjang kosong." }, { status: 400 });
  }
  if (typeof body.deliveryAddress !== "string" || body.deliveryAddress.trim().length < 5) {
    return NextResponse.json({ error: "Alamat pengantaran minimal 5 karakter." }, { status: 400 });
  }

  // Fetch customer profile
  const customer = await db.customer.findUnique({ where: { userId: me.id } });
  if (!customer) {
    return NextResponse.json({ error: "Profil customer tidak ditemukan." }, { status: 404 });
  }

  // Fetch all menu items yang diminta + validasi
  const menuItemIds = body.items.map((i: { menuItemId: string }) => i.menuItemId);
  const menuItems = await db.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    include: { merchant: true },
  });

  if (menuItems.length !== menuItemIds.length) {
    return NextResponse.json({ error: "Ada menu yang tidak ditemukan." }, { status: 400 });
  }

  // Semua item harus dari merchant yang sama
  const merchantIds = new Set(menuItems.map((m) => m.merchantId));
  if (merchantIds.size !== 1) {
    return NextResponse.json({ error: "Semua item harus dari restoran yang sama." }, { status: 400 });
  }

  const merchantId = menuItems[0].merchantId;
  const merchant = menuItems[0].merchant;

  if (!merchant.isOpen) {
    return NextResponse.json({ error: "Restoran sedang tutup. Tidak bisa memesan." }, { status: 400 });
  }

  // Validasi semua item available
  for (const mi of menuItems) {
    if (!mi.isAvailable) {
      return NextResponse.json({ error: `Menu "${mi.name}" sedang tidak tersedia.` }, { status: 400 });
    }
  }

  // Build order items + hitung subtotal
  const orderItems = body.items.map((i: { menuItemId: string; quantity: number }) => {
    const mi = menuItems.find((m) => m.id === i.menuItemId)!;
    const qty = Math.max(1, Math.floor(Number(i.quantity) || 1));
    return {
      menuItemId: mi.id,
      name: mi.name,
      price: mi.price,
      quantity: qty,
      subtotal: mi.price * qty,
    };
  });

  const subtotal = orderItems.reduce((sum, oi) => sum + oi.subtotal, 0);

  // Calculate dynamic delivery fee based on distance
  const deliveryEstimate = await estimateDeliveryFee(
    merchant.address || "Jakarta",
    body.deliveryAddress.trim(),
  );
  const deliveryFee = deliveryEstimate.fee;

  // === Promo validation (jika ada promoCode) ===
  let discountAmount = 0;
  let promoCode: string | null = null;
  if (body.promoCode && typeof body.promoCode === "string") {
    const codeInput = String(body.promoCode).trim().toUpperCase();
    const promo = await db.promo.findUnique({ where: { code: codeInput } });
    if (promo && promo.isActive) {
      const now = new Date();
      const inWindow = now >= promo.startsAt && now <= promo.endsAt;
      const quotaOk = promo.quota === 0 || promo.usedCount < promo.quota;
      const merchantOk = !promo.merchantId || promo.merchantId === merchantId;
      const minOk = subtotal >= promo.minOrder;
      if (inWindow && quotaOk && merchantOk && minOk) {
        if (promo.type === "PERCENTAGE") {
          discountAmount = Math.floor((subtotal * promo.value) / 100);
          if (promo.maxDiscount > 0 && discountAmount > promo.maxDiscount) {
            discountAmount = promo.maxDiscount;
          }
        } else {
          discountAmount = promo.value;
        }
        if (discountAmount > subtotal) discountAmount = subtotal;
        promoCode = promo.code;
        // Increment usedCount
        await db.promo.update({
          where: { id: promo.id },
          data: { usedCount: { increment: 1 } },
        });
      }
    }
  }

  const total = subtotal + deliveryFee - discountAmount;

  // Generate unique code (retry kalau collide)
  let code = generateOrderCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db.order.findUnique({ where: { code } });
    if (!existing) break;
    code = generateOrderCode();
  }

  const notes = body.notes ? String(body.notes).trim().slice(0, 500) : null;

  const order = await db.order.create({
    data: {
      code,
      customerId: customer.id,
      merchantId,
      status: OrderStatus.PENDING,
      subtotal,
      deliveryFee,
      discountAmount,
      promoCode,
      total,
      deliveryAddress: body.deliveryAddress.trim(),
      notes,
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
    action: "order.create",
    description: `Order ${order.code} dibuat untuk ${order.merchant.restaurantName}. Total Rp ${total.toLocaleString("id-ID")}.`,
    targetId: order.id,
    targetType: "order",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      code: order.code,
      merchantId,
      merchantName: order.merchant.restaurantName,
      subtotal,
      deliveryFee,
      discountAmount,
      promoCode,
      deliveryDistanceKm: deliveryEstimate.distanceKm,
      deliveryMethod: deliveryEstimate.method,
      total,
      itemCount: orderItems.length,
    },
  });

  // 🔔 Realtime: notify merchant + admin
  await emitOrderCreated({
    orderId: order.id,
    code: order.code,
    merchantUserId: merchant.userId,
    customerName: me.fullName,
    total,
    status: "PENDING",
    itemCount: orderItems.reduce((s, i) => s + i.quantity, 0),
  });

  // 🔔 Push notification: notify merchant
  sendNewOrderPush(merchant.userId, order.code, me.fullName, total).catch(() => {});

  return NextResponse.json({
    order: {
      id: order.id,
      code: order.code,
      status: order.status,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      discountAmount: order.discountAmount,
      promoCode: order.promoCode,
      total: order.total,
      deliveryAddress: order.deliveryAddress,
      notes: order.notes,
      createdAt: order.createdAt.toISOString(),
      merchant: order.merchant,
      items: order.items,
    },
  }, { status: 201 });
}

export async function GET(req: Request) {
  const me = await requireRole("CUSTOMER");
  if (!me) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const customer = await db.customer.findUnique({ where: { userId: me.id } });
  if (!customer) {
    return NextResponse.json({ error: "Profil customer tidak ditemukan." }, { status: 404 });
  }

  // Lazy auto-cancel: cleanup stale PENDING orders (>15 min without payment)
  // Fire-and-forget — don't block the response
  fetch(`${req.headers.get("origin") || "http://localhost:3000"}/api/orders/auto-cancel`, {
    method: "POST",
  }).catch(() => { /* silent — best effort */ });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 100);
  const cursor = url.searchParams.get("cursor") || undefined;
  const status = url.searchParams.get("status");

  const orders = await db.order.findMany({
    where: {
      customerId: customer.id,
      ...(status ? { status: status as OrderStatus } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      merchant: { select: { id: true, restaurantName: true, address: true } },
      driver: { select: { id: true, user: { select: { fullName: true } } } },
      items: true,
      review: { select: { id: true, rating: true, comment: true, createdAt: true } },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          code: true,
          method: true,
          status: true,
          amount: true,
          paymentUrl: true,
          expiresAt: true,
          paidAt: true,
        },
      },
    },
  });

  // Check if there are more items (we fetched limit + 1)
  const hasMore = orders.length > limit;
  const items = hasMore ? orders.slice(0, limit) : orders;

  return NextResponse.json({
    items: items.map((o) => ({
      id: o.id,
      code: o.code,
      status: o.status,
      subtotal: o.subtotal,
      deliveryFee: o.deliveryFee,
      total: o.total,
      deliveryAddress: o.deliveryAddress,
      notes: o.notes,
      createdAt: o.createdAt.toISOString(),
      acceptedAt: o.acceptedAt?.toISOString() ?? null,
      readyAt: o.readyAt?.toISOString() ?? null,
      pickedUpAt: o.pickedUpAt?.toISOString() ?? null,
      deliveredAt: o.deliveredAt?.toISOString() ?? null,
      cancelledAt: o.cancelledAt?.toISOString() ?? null,
      merchant: o.merchant,
      driver: o.driver ? { id: o.driver.id, name: o.driver.user.fullName } : null,
      items: o.items,
      itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
      payment: o.payments[0] ?? null,
      review: o.review ?? null,
    })),
  });
}
