/**
 * GET /api/restaurants/[id]/reviews
 *
 * Public list review untuk restoran. Dipakai di detail dialog customer.
 *
 * Query: limit (default 10, max 50), cursor (pagination)
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10", 10) || 10, 50);
  const cursor = url.searchParams.get("cursor") || undefined;

  // Verify merchant exists
  const merchant = await db.merchant.findUnique({
    where: { id },
    select: { id: true, restaurantName: true, rating: true },
  });
  if (!merchant) {
    return NextResponse.json({ error: "Restoran tidak ditemukan." }, { status: 404 });
  }

  const [items, total] = await Promise.all([
    db.review.findMany({
      where: { merchantId: id },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        customer: {
          select: { user: { select: { fullName: true } } },
        },
      },
    }),
    db.review.count({ where: { merchantId: id } }),
  ]);

  let nextCursor: string | null = null;
  if (items.length > limit) {
    nextCursor = items[items.length - 1].id;
    items.pop();
  }

  // Compute rating distribution
  const allReviews = await db.review.findMany({
    where: { merchantId: id },
    select: { rating: true },
  });
  const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of allReviews) {
    distribution[r.rating] = (distribution[r.rating] ?? 0) + 1;
  }

  return NextResponse.json({
    merchant: {
      id: merchant.id,
      restaurantName: merchant.restaurantName,
      rating: merchant.rating,
      totalReviews: total,
    },
    distribution,
    items: items.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      customerName: r.customer.user.fullName,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor,
    total,
  });
}
