/**
 * GET /api/restaurants
 *
 * Public endpoint — list restoran untuk customer browse.
 *
 * Query params:
 *  - q        : search by restaurantName/description/cuisine (case-insensitive)
 *  - cuisine  : filter by cuisine exact match
 *  - openOnly : "true" → hanya yang isOpen=true
 *  - limit    : default 20, max 100
 *  - cursor   : pagination cursor (last merchant id)
 *
 * Returns: { items, nextCursor, total }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const cuisine = url.searchParams.get("cuisine")?.trim();
  const openOnly = url.searchParams.get("openOnly") === "true";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 100);
  const cursor = url.searchParams.get("cursor") || undefined;

  const where: Record<string, unknown> = {};
  if (openOnly) where.isOpen = true;
  if (cuisine) where.cuisine = cuisine;
  if (q) {
    where.OR = [
      { restaurantName: { contains: q } },
      { description: { contains: q } },
      { cuisine: { contains: q } },
    ];
  }

  const [items, total] = await Promise.all([
    db.merchant.findMany({
      where,
      orderBy: [{ isOpen: "desc" }, { rating: "desc" }, { restaurantName: "asc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        restaurantName: true,
        description: true,
        logoUrl: true,
        address: true,
        cuisine: true,
        rating: true,
        isOpen: true,
        _count: { select: { menuItems: { where: { isAvailable: true } } } },
      },
    }),
    db.merchant.count({ where }),
  ]);

  let nextCursor: string | null = null;
  if (items.length > limit) {
    nextCursor = items[items.length - 1].id;
    items.pop();
  }

  return NextResponse.json({
    items: items.map((m) => ({
      ...m,
      menuCount: m._count.menuItems,
      _count: undefined,
    })),
    nextCursor,
    total,
  }, {
    headers: {
      // Cache 30 detik di browser — restaurant list jarang berubah
      // Stale-while-revalidate: serve cached dulu, revalidate di background
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
