/**
 * GET /api/merchant/stats
 * Revenue + order stats for merchant dashboard.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";

export async function GET() {
  const me = await requireRole("MERCHANT");
  if (!me) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const merchant = await db.merchant.findUnique({ where: { userId: me.id } });
  if (!merchant) return NextResponse.json({ error: "Merchant tidak ditemukan." }, { status: 404 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [
    activeOrders, deliveredToday, revenueToday,
    deliveredThisWeek, revenueThisWeek,
    totalOrders, totalRevenue, pendingOrders,
  ] = await Promise.all([
    db.order.count({
      where: { merchantId: merchant.id, status: { in: ["PENDING", "ACCEPTED", "PREPARING", "READY", "PICKED_UP"] } },
    }),
    db.order.count({
      where: { merchantId: merchant.id, status: "DELIVERED", deliveredAt: { gte: today } },
    }),
    db.order.aggregate({
      where: { merchantId: merchant.id, status: "DELIVERED", deliveredAt: { gte: today } },
      _sum: { subtotal: true },
    }),
    db.order.count({
      where: { merchantId: merchant.id, status: "DELIVERED", deliveredAt: { gte: weekAgo } },
    }),
    db.order.aggregate({
      where: { merchantId: merchant.id, status: "DELIVERED", deliveredAt: { gte: weekAgo } },
      _sum: { subtotal: true },
    }),
    db.order.count({
      where: { merchantId: merchant.id, status: "DELIVERED" },
    }),
    db.order.aggregate({
      where: { merchantId: merchant.id, status: "DELIVERED" },
      _sum: { subtotal: true },
    }),
    db.order.count({
      where: { merchantId: merchant.id, status: "PENDING" },
    }),
  ]);

  return NextResponse.json({
    today: {
      orders: deliveredToday,
      revenue: revenueToday._sum.subtotal ?? 0,
      active: activeOrders,
      pending: pendingOrders,
    },
    week: {
      orders: deliveredThisWeek,
      revenue: revenueThisWeek._sum.subtotal ?? 0,
    },
    total: {
      orders: totalOrders,
      revenue: totalRevenue._sum.subtotal ?? 0,
    },
  });
}
