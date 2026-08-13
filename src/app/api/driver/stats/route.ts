/**
 * GET /api/driver/stats
 * Earnings + delivery stats for driver dashboard.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";

export async function GET() {
  const me = await requireRole("DRIVER");
  if (!me) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const driver = await db.driver.findUnique({ where: { userId: me.id } });
  if (!driver) return NextResponse.json({ error: "Driver tidak ditemukan." }, { status: 404 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [deliveredToday, earningsToday, deliveredWeek, earningsWeek, totalDelivered, totalEarnings, activeDeliveries] = await Promise.all([
    db.order.count({
      where: { driverId: driver.id, status: "DELIVERED", deliveredAt: { gte: today } },
    }),
    db.order.aggregate({
      where: { driverId: driver.id, status: "DELIVERED", deliveredAt: { gte: today } },
      _sum: { deliveryFee: true },
    }),
    db.order.count({
      where: { driverId: driver.id, status: "DELIVERED", deliveredAt: { gte: weekAgo } },
    }),
    db.order.aggregate({
      where: { driverId: driver.id, status: "DELIVERED", deliveredAt: { gte: weekAgo } },
      _sum: { deliveryFee: true },
    }),
    db.order.count({
      where: { driverId: driver.id, status: "DELIVERED" },
    }),
    db.order.aggregate({
      where: { driverId: driver.id, status: "DELIVERED" },
      _sum: { deliveryFee: true },
    }),
    db.order.count({
      where: { driverId: driver.id, status: "PICKED_UP" },
    }),
  ]);

  return NextResponse.json({
    today: {
      deliveries: deliveredToday,
      earnings: earningsToday._sum.deliveryFee ?? 0,
    },
    week: {
      deliveries: deliveredWeek,
      earnings: earningsWeek._sum.deliveryFee ?? 0,
    },
    total: {
      deliveries: totalDelivered,
      earnings: totalEarnings._sum.deliveryFee ?? 0,
      rating: driver.rating,
    },
    active: activeDeliveries,
  });
}
