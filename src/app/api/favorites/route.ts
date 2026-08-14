/**
 * GET /api/favorites
 * List restoran favorit milik customer yang login.
 *
 * POST /api/favorites
 * Toggle favorite (add if not exists, remove if exists).
 * Body: { merchantId: string }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";

export async function GET() {
  try {
    const me = await requireRole("CUSTOMER");
    if (!me) {
      return NextResponse.json({ error: "Forbidden. Hanya customer." }, { status: 403 });
    }

    const customer = await db.customer.findUnique({ where: { userId: me.id } });
    if (!customer) {
      return NextResponse.json({ error: "Profil customer tidak ditemukan." }, { status: 404 });
    }

    const favorites = await db.favorite.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      include: {
        merchant: {
          select: {
            id: true,
            restaurantName: true,
            description: true,
            logoUrl: true,
            address: true,
            cuisine: true,
            rating: true,
            isOpen: true,
            promoTag: true,
            prepTime: true,
            _count: { select: { menuItems: { where: { isAvailable: true } } } },
          },
        },
      },
    });

    return NextResponse.json({
      items: favorites.map((f) => ({
        id: f.id,
        merchant: {
          ...f.merchant,
          menuCount: f.merchant._count.menuItems,
          _count: undefined,
        },
        favoritedAt: f.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[favorites GET] error:", err);
    return NextResponse.json({ error: "Gagal memuat favorit." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole("CUSTOMER");
    if (!me) {
      return NextResponse.json({ error: "Forbidden. Hanya customer." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.merchantId) {
      return NextResponse.json({ error: "merchantId wajib diisi." }, { status: 400 });
    }

    const customer = await db.customer.findUnique({ where: { userId: me.id } });
    if (!customer) {
      return NextResponse.json({ error: "Profil customer tidak ditemukan." }, { status: 404 });
    }

    const merchant = await db.merchant.findUnique({ where: { id: body.merchantId } });
    if (!merchant) {
      return NextResponse.json({ error: "Restoran tidak ditemukan." }, { status: 404 });
    }

    const existing = await db.favorite.findUnique({
      where: {
        customerId_merchantId: {
          customerId: customer.id,
          merchantId: body.merchantId,
        },
      },
    });

    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } });
      return NextResponse.json({ favorited: false });
    } else {
      await db.favorite.create({
        data: {
          customerId: customer.id,
          merchantId: body.merchantId,
        },
      });
      return NextResponse.json({ favorited: true });
    }
  } catch (err) {
    console.error("[favorites POST] error:", err);
    return NextResponse.json({ error: "Gagal mengubah favorit." }, { status: 500 });
  }
}
