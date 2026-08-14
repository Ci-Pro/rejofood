/**
 * POST /api/promo/validate
 *
 * Validate promo code sebelum apply ke order.
 *
 * Body: { code: string, subtotal: number, merchantId?: string }
 *
 * Return:
 *  - 200 { valid: true, discount, description, minOrder } jika valid
 *  - 400 { valid: false, error } jika invalid
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";
import { PromoType } from "@prisma/client";

export async function POST(req: Request) {
  try {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.code || typeof body.subtotal !== "number") {
    return NextResponse.json(
      { valid: false, error: "Code dan subtotal wajib diisi." },
      { status: 400 },
    );
  }

  const code = String(body.code).trim().toUpperCase();
  const subtotal = Number(body.subtotal);
  const merchantId = body.merchantId ? String(body.merchantId) : null;

  const promo = await db.promo.findUnique({
    where: { code },
  });

  if (!promo || !promo.isActive) {
    return NextResponse.json(
      { valid: false, error: "Kode promo tidak ditemukan atau tidak aktif." },
      { status: 400 },
    );
  }

  // Cek waktu berlaku
  const now = new Date();
  if (now < promo.startsAt) {
    return NextResponse.json(
      { valid: false, error: "Promo belum berlaku." },
      { status: 400 },
    );
  }
  if (now > promo.endsAt) {
    return NextResponse.json(
      { valid: false, error: "Promo sudah berakhir." },
      { status: 400 },
    );
  }

  // Cek kuota
  if (promo.quota > 0 && promo.usedCount >= promo.quota) {
    return NextResponse.json(
      { valid: false, error: "Kuota promo sudah habis." },
      { status: 400 },
    );
  }

  // Cek merchant spesifik
  if (promo.merchantId && merchantId && promo.merchantId !== merchantId) {
    return NextResponse.json(
      { valid: false, error: "Promo tidak berlaku untuk restoran ini." },
      { status: 400 },
    );
  }

  // Cek minimum order
  if (subtotal < promo.minOrder) {
    return NextResponse.json(
      {
        valid: false,
        error: `Minimum order Rp ${promo.minOrder.toLocaleString("id-ID")} untuk promo ini.`,
      },
      { status: 400 },
    );
  }

  // Hitung diskon
  let discount = 0;
  if (promo.type === PromoType.PERCENTAGE) {
    discount = Math.floor((subtotal * promo.value) / 100);
    if (promo.maxDiscount > 0 && discount > promo.maxDiscount) {
      discount = promo.maxDiscount;
    }
  } else {
    // FLAT
    discount = promo.value;
  }

  // Diskon tidak boleh melebihi subtotal
  if (discount > subtotal) discount = subtotal;

  return NextResponse.json({
    valid: true,
    code: promo.code,
    description: promo.description,
    type: promo.type,
    value: promo.value,
    discount,
    minOrder: promo.minOrder,
  });
  } catch (err) {
    console.error("[promo/validate] error:", err);
    return NextResponse.json({ valid: false, error: "Gagal validasi promo." }, { status: 500 });
  }
}
