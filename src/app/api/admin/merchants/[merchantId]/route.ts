/**
 * PATCH /api/admin/merchants/[merchantId]
 * Admin: toggle isOpen, set promoTag, set prepTime
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ merchantId: string }> },
) {
  const me = await requireRole("ADMIN");
  if (!me) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const meta = getRequestMeta(req);
  const { merchantId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.isOpen === "boolean") data.isOpen = body.isOpen;
  if (body.promoTag !== undefined) data.promoTag = body.promoTag ? String(body.promoTag).trim().slice(0, 50) : null;
  if (body.prepTime !== undefined) {
    const pt = Number(body.prepTime);
    if (Number.isInteger(pt) && pt >= 1 && pt <= 120) data.prepTime = pt;
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Tidak ada field untuk diupdate." }, { status: 400 });

  try {
    const merchant = await db.merchant.update({ where: { id: merchantId }, data });
    await logAction({
      actorId: me.id, actorEmail: me.email, actorRole: me.role,
      category: "admin", action: "admin.merchant.update",
      description: `Merchant "${merchant.restaurantName}" diupdate admin. Fields: ${Object.keys(data).join(", ")}.`,
      targetId: merchant.id, targetType: "merchant", outcome: "success",
      ipAddress: meta.ipAddress, userAgent: meta.userAgent,
    });
    return NextResponse.json({ merchant });
  } catch (err) {
    console.error("[admin/merchants PATCH]", err);
    return NextResponse.json({ error: "Gagal update merchant." }, { status: 500 });
  }
}
