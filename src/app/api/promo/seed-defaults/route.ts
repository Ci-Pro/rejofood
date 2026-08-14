/**
 * POST /api/promo/seed-defaults
 *
 * Seed default promo codes untuk demo/MVP.
 * Admin only — jalankan sekali untuk setup promo awal.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { PromoType } from "@prisma/client";

const DEFAULT_PROMOS = [
  {
    code: "REJO10",
    description: "Diskon 10% untuk pesanan pertama",
    type: PromoType.PERCENTAGE,
    value: 10,
    minOrder: 20000,
    maxDiscount: 15000,
    merchantId: null,
    quota: 1000,
    endsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 hari
  },
  {
    code: "HEMAT15",
    description: "Diskon 15% (maks Rp 25.000)",
    type: PromoType.PERCENTAGE,
    value: 15,
    minOrder: 50000,
    maxDiscount: 25000,
    merchantId: null,
    quota: 500,
    endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 hari
  },
  {
    code: "GRATISONGKIR",
    description: "Diskon ongkir Rp 10.000",
    type: PromoType.FLAT,
    value: 10000,
    minOrder: 30000,
    maxDiscount: 0,
    merchantId: null,
    quota: 2000,
    endsAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 hari
  },
  {
    code: "REJOFOOD25",
    description: "Diskon 25% (maks Rp 50.000)",
    type: PromoType.PERCENTAGE,
    value: 25,
    minOrder: 100000,
    maxDiscount: 50000,
    merchantId: null,
    quota: 100,
    endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 hari
  },
];

export async function POST(req: Request) {
  const me = await requireRole("ADMIN");
  if (!me) {
    return NextResponse.json({ error: "Forbidden. Admin only." }, { status: 403 });
  }

  const meta = getRequestMeta(req);
  let created = 0;
  let skipped = 0;

  for (const promo of DEFAULT_PROMOS) {
    const existing = await db.promo.findUnique({ where: { code: promo.code } });
    if (existing) {
      skipped++;
      continue;
    }
    await db.promo.create({ data: promo });
    created++;
  }

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "promo",
    action: "promo.seed_defaults",
    description: `Seed default promo codes: ${created} created, ${skipped} already exist.`,
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    total: DEFAULT_PROMOS.length,
  });
}
