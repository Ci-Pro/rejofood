/**
 * GET /api/merchant/menu
 * List menu items milik merchant yang sedang login (semua, termasuk unavailable).
 *
 * POST /api/merchant/menu
 * Tambah menu item baru. Body: { name, description?, price, imageUrl?, category?, isAvailable? }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";

export async function GET() {
  const me = await requireRole("MERCHANT");
  if (!me) {
    return NextResponse.json({ error: "Forbidden. Hanya merchant." }, { status: 403 });
  }

  const merchant = await db.merchant.findUnique({
    where: { userId: me.id },
    include: {
      menuItems: { orderBy: [{ category: "asc" }, { name: "asc" }] },
    },
  });

  if (!merchant) {
    return NextResponse.json({ error: "Profil merchant tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({
    merchant: {
      id: merchant.id,
      restaurantName: merchant.restaurantName,
      description: merchant.description,
      address: merchant.address,
      cuisine: merchant.cuisine,
      logoUrl: merchant.logoUrl,
      rating: merchant.rating,
      isOpen: merchant.isOpen,
    },
    items: merchant.menuItems,
  });
}

export async function POST(req: Request) {
  const me = await requireRole("MERCHANT");
  if (!me) {
    return NextResponse.json({ error: "Forbidden. Hanya merchant." }, { status: 403 });
  }

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const name = String(body.name ?? "").trim();
  const description = body.description ? String(body.description).trim() : null;
  const price = Math.floor(Number(body.price));
  const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
  const category = body.category ? String(body.category).trim() : "Lainnya";
  const isAvailable = body.isAvailable !== false;

  if (name.length < 2) {
    return NextResponse.json({ error: "Nama menu minimal 2 karakter." }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "Harga tidak valid (harus angka ≥ 0)." }, { status: 400 });
  }
  if (price > 10_000_000) {
    return NextResponse.json({ error: "Harga maksimum Rp 10.000.000." }, { status: 400 });
  }

  const merchant = await db.merchant.findUnique({ where: { userId: me.id } });
  if (!merchant) {
    return NextResponse.json({ error: "Profil merchant tidak ditemukan." }, { status: 404 });
  }

  const item = await db.menuItem.create({
    data: {
      merchantId: merchant.id,
      name,
      description,
      price,
      imageUrl,
      category,
      isAvailable,
    },
  });

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "merchant",
    action: "merchant.menu.create",
    description: `Menu baru ditambahkan: "${name}" (Rp ${price.toLocaleString("id-ID")}).`,
    targetId: item.id,
    targetType: "menu_item",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { name, price, category, isAvailable },
  });

  return NextResponse.json({ item }, { status: 201 });
}
