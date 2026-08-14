/**
 * POST /api/delivery/estimate
 *
 * Estimate delivery fee from merchant to customer address.
 * Body: { merchantId: string, deliveryAddress: string }
 *
 * Returns: { distanceKm, durationMin, fee, breakdown, method }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { estimateDeliveryFee, formatFee, formatDistance } from "@/lib/delivery-fee";

export async function POST(req: Request) {
  try {
  const me = await requireRole("CUSTOMER");
  if (!me) {
    return NextResponse.json({ error: "Forbidden. Hanya customer." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.merchantId || !body?.deliveryAddress) {
    return NextResponse.json(
      { error: "merchantId dan deliveryAddress wajib diisi." },
      { status: 400 },
    );
  }

  if (typeof body.deliveryAddress !== "string" || body.deliveryAddress.trim().length < 5) {
    return NextResponse.json(
      { error: "Alamat pengantaran minimal 5 karakter." },
      { status: 400 },
    );
  }

  const merchant = await db.merchant.findUnique({
    where: { id: body.merchantId },
    select: { id: true, restaurantName: true, address: true },
  });
  if (!merchant) {
    return NextResponse.json({ error: "Restoran tidak ditemukan." }, { status: 404 });
  }

  if (!merchant.address) {
    // No merchant address → return flat fee
    return NextResponse.json({
      distanceKm: 0,
      durationMin: null,
      fee: 8000,
      breakdown: {
        baseFee: 8000,
        perKmFee: 0,
        total: 8000,
        capped: false,
        freeDelivery: false,
      },
      method: "flat",
      feeFormatted: "Rp 8.000",
      distanceFormatted: "—",
    });
  }

  const estimate = await estimateDeliveryFee(
    merchant.address,
    body.deliveryAddress.trim(),
  );

  return NextResponse.json({
    ...estimate,
    feeFormatted: formatFee(estimate.fee),
    distanceFormatted: formatDistance(estimate.distanceKm),
  });
  } catch (err) {
    console.error("[delivery/estimate] error:", err);
    return NextResponse.json({ error: "Gagal menghitung ongkir." }, { status: 500 });
  }
}
