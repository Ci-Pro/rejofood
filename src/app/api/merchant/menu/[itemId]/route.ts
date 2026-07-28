/**
 * PATCH /api/merchant/menu/[itemId]
 * Update menu item (name, description, price, imageUrl, category, isAvailable).
 *
 * DELETE /api/merchant/menu/[itemId]
 * Hapus menu item permanent. Untuk stok habis sementara, gunakan PATCH isAvailable=false.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";

async function getOwnedItem(itemId: string, userId: string) {
  const merchant = await db.merchant.findUnique({ where: { userId } });
  if (!merchant) return null;
  const item = await db.menuItem.findUnique({ where: { id: itemId } });
  if (!item || item.merchantId !== merchant.id) return null;
  return item;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const me = await requireRole("MERCHANT");
  if (!me) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { itemId } = await params;
  const existing = await getOwnedItem(itemId, me.id);
  if (!existing) {
    return NextResponse.json({ error: "Menu tidak ditemukan." }, { status: 404 });
  }

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length < 2) return NextResponse.json({ error: "Nama minimal 2 karakter." }, { status: 400 });
    data.name = name;
  }
  if (body.description !== undefined) {
    data.description = body.description ? String(body.description).trim() : null;
  }
  if (body.price !== undefined) {
    const price = Math.floor(Number(body.price));
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Harga tidak valid." }, { status: 400 });
    }
    if (price > 10_000_000) {
      return NextResponse.json({ error: "Harga maksimum Rp 10.000.000." }, { status: 400 });
    }
    data.price = price;
  }
  if (body.imageUrl !== undefined) {
    data.imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
  }
  if (typeof body.category === "string") {
    data.category = body.category.trim() || "Lainnya";
  }
  if (typeof body.isAvailable === "boolean") {
    data.isAvailable = body.isAvailable;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada field untuk diupdate." }, { status: 400 });
  }

  const updated = await db.menuItem.update({
    where: { id: itemId },
    data,
  });

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "merchant",
    action: "merchant.menu.update",
    description: `Menu "${updated.name}" diperbarui. Field: ${Object.keys(data).join(", ")}.`,
    targetId: updated.id,
    targetType: "menu_item",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { changes: data },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const me = await requireRole("MERCHANT");
  if (!me) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { itemId } = await params;
  const existing = await getOwnedItem(itemId, me.id);
  if (!existing) {
    return NextResponse.json({ error: "Menu tidak ditemukan." }, { status: 404 });
  }

  const meta = getRequestMeta(req);

  await db.menuItem.delete({ where: { id: itemId } });

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "merchant",
    action: "merchant.menu.delete",
    description: `Menu "${existing.name}" dihapus permanen.`,
    targetId: existing.id,
    targetType: "menu_item",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true });
}
