/**
 * GET /api/menu-items/search?q=...
 *
 * Search menu items across all restaurants by name/description.
 * Returns items with merchant info for display.
 *
 * Query: q (search string, min 2 chars), limit (default 20, max 50)
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 50);

  if (q.length < 2) {
    return NextResponse.json({ items: [], total: 0 });
  }

  const items = await db.menuItem.findMany({
    where: {
      isAvailable: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ name: "asc" }],
    take: limit,
    include: {
      merchant: {
        select: {
          id: true,
          restaurantName: true,
          cuisine: true,
          rating: true,
          isOpen: true,
          address: true,
        },
      },
    },
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      imageUrl: item.imageUrl,
      category: item.category,
      merchant: item.merchant,
    })),
    total: items.length,
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
