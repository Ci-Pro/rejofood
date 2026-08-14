/**
 * GET /api/admin/merchants — list all merchants with stats
 * Query: ?search=&openOnly=&page=&limit=
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";

export async function GET(req: Request) {
  const me = await requireRole("ADMIN");
  if (!me) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
  const search = url.searchParams.get("search")?.trim() ?? "";
  const openOnly = url.searchParams.get("openOnly") === "true";

  const where: {
    OR?: { restaurantName?: { contains: string }; user?: { email?: { contains: string } } }[];
    isOpen?: boolean;
  } = {};
  if (search) {
    where.OR = [
      { restaurantName: { contains: search } },
      { user: { email: { contains: search } } },
    ];
  }
  if (openOnly) where.isOpen = true;

  try {
    const [merchants, total] = await Promise.all([
      db.merchant.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, email: true, isActive: true, isFlagged: true } },
          _count: { select: { menuItems: true, orders: true, reviews: true } },
        },
      }),
      db.merchant.count({ where }),
    ]);

    return NextResponse.json({
      items: merchants.map((m) => ({
        id: m.id,
        restaurantName: m.restaurantName,
        cuisine: m.cuisine,
        rating: m.rating,
        isOpen: m.isOpen,
        promoTag: m.promoTag,
        prepTime: m.prepTime,
        address: m.address,
        createdAt: m.createdAt,
        user: m.user,
        menuCount: m._count.menuItems,
        orderCount: m._count.orders,
        reviewCount: m._count.reviews,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[admin/merchants GET]", err);
    return NextResponse.json({ error: "Gagal memuat merchant." }, { status: 500 });
  }
}
