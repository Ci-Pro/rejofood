/**
 * PATCH /api/merchant/profile
 * Update profil restoran: restaurantName, description, address, cuisine, logoUrl, isOpen.
 * Body hanya berisi field yang ingin diubah (partial update).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";

export async function PATCH(req: Request) {
  const me = await requireRole("MERCHANT");
  if (!me) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.restaurantName === "string") {
    const n = body.restaurantName.trim();
    if (n.length < 2) return NextResponse.json({ error: "Nama restoran minimal 2 karakter." }, { status: 400 });
    data.restaurantName = n;
  }
  if (body.description !== undefined) {
    data.description = body.description ? String(body.description).trim() : null;
  }
  if (body.address !== undefined) {
    data.address = body.address ? String(body.address).trim() : null;
  }
  if (body.cuisine !== undefined) {
    data.cuisine = body.cuisine ? String(body.cuisine).trim() : null;
  }
  if (body.logoUrl !== undefined) {
    data.logoUrl = body.logoUrl ? String(body.logoUrl).trim() : null;
  }
  if (typeof body.isOpen === "boolean") {
    data.isOpen = body.isOpen;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada field untuk diupdate." }, { status: 400 });
  }

  const merchant = await db.merchant.update({
    where: { userId: me.id },
    data,
  });

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "merchant",
    action: "merchant.profile.update",
    description: `Profil restoran "${merchant.restaurantName}" diperbarui. Field: ${Object.keys(data).join(", ")}.`,
    targetId: merchant.id,
    targetType: "merchant",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { changes: data },
  });

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
  });
}
