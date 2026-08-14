/**
 * GET /api/admin/stats
 * Real dashboard stats for admin.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/context";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalCustomers, totalMerchants, totalDrivers, totalAdmins,
    activeOrders, deliveredToday, gmvToday, totalReviews, avgRating,
    flaggedCount, totalRevenue, openMerchants, activePromos,
  ] = await Promise.all([
    db.user.count({ where: { role: "CUSTOMER", isActive: true } }),
    db.user.count({ where: { role: "MERCHANT", isActive: true } }),
    db.user.count({ where: { role: "DRIVER", isActive: true } }),
    db.user.count({ where: { role: "ADMIN", isActive: true } }),
    db.order.count({ where: { status: { in: ["PENDING", "ACCEPTED", "PREPARING", "READY", "PICKED_UP"] } } }),
    db.order.count({ where: { status: "DELIVERED", deliveredAt: { gte: today } } }),
    db.order.aggregate({
      where: { status: "DELIVERED", deliveredAt: { gte: today } },
      _sum: { total: true },
    }),
    db.review.count(),
    db.review.aggregate({ _avg: { rating: true } }),
    db.user.count({ where: { isFlagged: true } }),
    db.order.aggregate({ where: { status: "DELIVERED" }, _sum: { total: true } }),
    db.merchant.count({ where: { isOpen: true } }),
    db.promo.count({ where: { isActive: true } }),
  ]);

  return NextResponse.json({
    users: {
      customers: totalCustomers,
      merchants: totalMerchants,
      drivers: totalDrivers,
      admins: totalAdmins,
      flagged: flaggedCount,
    },
    orders: {
      active: activeOrders,
      deliveredToday,
      gmvToday: gmvToday._sum.total ?? 0,
    },
    revenue: {
      total: totalRevenue._sum.total ?? 0,
    },
    merchants: {
      open: openMerchants,
      total: totalMerchants,
    },
    promos: {
      active: activePromos,
    },
    reviews: {
      total: totalReviews,
      avgRating: avgRating._avg.rating ? Math.round(avgRating._avg.rating * 10) / 10 : 0,
    },
  });
}
