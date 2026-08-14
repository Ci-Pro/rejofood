/**
 * GET /api/admin/revenue-chart
 *
 * 7-day revenue + order count breakdown untuk admin chart.
 * Return: { days: [{ date, label, revenue, orders }] }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";

export async function GET() {
  const me = await requireRole("ADMIN");
  if (!me) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  try {
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const days: { date: string; label: string; revenue: number; orders: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);

      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const [agg, count] = await Promise.all([
        db.order.aggregate({
          where: {
            status: "DELIVERED",
            deliveredAt: { gte: start, lt: end },
          },
          _sum: { total: true },
        }),
        db.order.count({
          where: {
            status: "DELIVERED",
            deliveredAt: { gte: start, lt: end },
          },
        }),
      ]);

      days.push({
        date: start.toISOString().split("T")[0],
        label: dayNames[start.getDay()],
        revenue: agg._sum.total ?? 0,
        orders: count,
      });
    }

    const totalRevenue = days.reduce((s, d) => s + d.revenue, 0);
    const totalOrders = days.reduce((s, d) => s + d.orders, 0);

    return NextResponse.json({
      days,
      totalRevenue,
      totalOrders,
      avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
    });
  } catch (err) {
    console.error("[admin/revenue-chart]", err);
    return NextResponse.json({ error: "Gagal memuat chart data." }, { status: 500 });
  }
}
