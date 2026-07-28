/**
 * GET /api/admin/orders
 *
 * Admin-only: list semua order dengan filter status.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/context";
import { OrderStatus } from "@prisma/client";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);
  const status = url.searchParams.get("status");
  const cursor = url.searchParams.get("cursor") || undefined;

  const where: Record<string, unknown> = {};
  if (status) where.status = status as OrderStatus;

  const items = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      customer: { select: { user: { select: { fullName: true } } } },
      merchant: { select: { restaurantName: true } },
      driver: { select: { user: { select: { fullName: true } } } },
      items: { select: { id: true, quantity: true } },
    },
  });

  let nextCursor: string | null = null;
  if (items.length > limit) {
    nextCursor = items[items.length - 1].id;
    items.pop();
  }

  const total = await db.order.count({ where });

  return NextResponse.json({
    items: items.map((o) => ({
      id: o.id,
      code: o.code,
      status: o.status,
      total: o.total,
      subtotal: o.subtotal,
      deliveryFee: o.deliveryFee,
      createdAt: o.createdAt.toISOString(),
      deliveredAt: o.deliveredAt?.toISOString() ?? null,
      customerName: o.customer.user.fullName,
      merchantName: o.merchant.restaurantName,
      driverName: o.driver?.user.fullName ?? null,
      itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
    })),
    nextCursor,
    total,
  });
}
