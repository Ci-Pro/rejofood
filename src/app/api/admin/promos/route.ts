/**
 * GET /api/admin/promos — list all promo codes
 * POST /api/admin/promos — create new promo code
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { rateLimitResponse } from "@/lib/auth/api-rate-limiter";
import { PromoType } from "@prisma/client";

export async function GET(req: Request) {
  const me = await requireRole("ADMIN");
  if (!me) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  try {
    const promos = await db.promo.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        merchant: { select: { id: true, restaurantName: true } },
      },
    });
    return NextResponse.json({ items: promos });
  } catch (err) {
    console.error("[admin/promos GET]", err);
    return NextResponse.json({ error: "Gagal memuat promo." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const limited = rateLimitResponse(req, "promo:create", 10, 60_000);
  if (limited) return limited;

  const me = await requireRole("ADMIN");
  if (!me) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const code = String(body.code ?? "").trim().toUpperCase();
  const description = String(body.description ?? "").trim();
  const type = body.type === "FLAT" ? PromoType.FLAT : PromoType.PERCENTAGE;
  const value = Number(body.value);
  const minOrder = Number(body.minOrder ?? 0);
  const maxDiscount = Number(body.maxDiscount ?? 0);
  const quota = Number(body.quota ?? 0);
  const merchantId = body.merchantId ? String(body.merchantId) : null;
  const endsAt = body.endsAt ? new Date(body.endsAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  if (code.length < 3) return NextResponse.json({ error: "Code minimal 3 karakter." }, { status: 400 });
  if (!description) return NextResponse.json({ error: "Deskripsi wajib diisi." }, { status: 400 });
  if (!Number.isFinite(value) || value <= 0) return NextResponse.json({ error: "Value tidak valid." }, { status: 400 });
  if (type === PromoType.PERCENTAGE && value > 100) return NextResponse.json({ error: "Persentase maksimal 100." }, { status: 400 });

  try {
    const existing = await db.promo.findUnique({ where: { code } });
    if (existing) return NextResponse.json({ error: "Code sudah dipakai." }, { status: 409 });

    const promo = await db.promo.create({
      data: { code, description, type, value, minOrder, maxDiscount, quota, merchantId, endsAt },
    });

    await logAction({
      actorId: me.id, actorEmail: me.email, actorRole: me.role,
      category: "promo", action: "promo.create",
      description: `Promo ${code} dibuat oleh admin.`,
      targetId: promo.id, targetType: "promo", outcome: "success",
      ipAddress: meta.ipAddress, userAgent: meta.userAgent,
    });

    return NextResponse.json({ promo }, { status: 201 });
  } catch (err) {
    console.error("[admin/promos POST]", err);
    return NextResponse.json({ error: "Gagal membuat promo." }, { status: 500 });
  }
}
