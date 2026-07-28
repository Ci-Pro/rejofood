/**
 * GET /api/restaurants/[id]
 *
 * Public endpoint — detail restoran + semua menu items yang available.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const merchant = await db.merchant.findUnique({
    where: { id },
    select: {
      id: true,
      restaurantName: true,
      description: true,
      logoUrl: true,
      address: true,
      cuisine: true,
      rating: true,
      isOpen: true,
      menuItems: {
        where: { isAvailable: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          imageUrl: true,
          category: true,
        },
      },
      _count: { select: { reviews: true } },
    },
  });

  if (!merchant) {
    return NextResponse.json({ error: "Restoran tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({
    merchant: {
      ...merchant,
      reviewCount: merchant._count.reviews,
      _count: undefined,
    },
  });
}
