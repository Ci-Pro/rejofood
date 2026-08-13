/**
 * GET /api/merchant/orders
 * List pesanan masuk untuk merchant yang sedang login.
 *
 * Query: status (filter), limit (default 20)
 *
 * Returns orders dengan customer info + items + driver info.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { OrderStatus } from "@prisma/client";

export async function GET(req: Request) {
  const me = await requireRole("MERCHANT");
  if (!me) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const merchant = await db.merchant.findUnique({ where: { userId: me.id } });
  if (!merchant) {
    return NextResponse.json({ error: "Profil merchant tidak ditemukan." }, { status: 404 });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "30", 10) || 30, 100);
  const status = url.searchParams.get("status");

  // Default: exclude DELIVERED dan CANCELLED yang lebih dari 24 jam
  const where: Record<string, unknown> = { merchantId: merchant.id };
  if (status) {
    where.status = status as OrderStatus;
  } else {
    // Tampilkan aktif (PENDING → PICKED_UP) + DELIVERED/CANCELLED hari ini
    where.OR = [
      { status: { in: ["PENDING", "ACCEPTED", "PREPARING", "READY", "PICKED_UP"] } },
      { status: { in: ["DELIVERED", "CANCELLED"] }, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    ];
  }

  const orders = await db.order.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      customer: { select: { id: true, user: { select: { fullName: true, phone: true } } } },
      driver: { select: { id: true, user: { select: { fullName: true } } } },
      items: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          code: true,
          method: true,
          status: true,
          amount: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    items: orders.map((o) => ({
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
      customer: {
        id: o.customer.id,
        name: o.customer.user.fullName,
        phone: o.customer.user.phone,
      },
      driver: o.driver ? { id: o.driver.id, name: o.driver.user.fullName } : null,
      items: o.items,
      payment: o.payments[0] ? {
        method: o.payments[0].method,
        status: o.payments[0].status,
      } : null,
      itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
    })),
  });
}
