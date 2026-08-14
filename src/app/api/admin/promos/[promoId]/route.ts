/**
 * PATCH /api/admin/promos/[promoId] — update promo (toggle active, edit fields)
 * DELETE /api/admin/promos/[promoId] — delete promo
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { PromoType } from "@prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ promoId: string }> },
) {
  const me = await requireRole("ADMIN");
  if (!me) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const meta = getRequestMeta(req);
  const { promoId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.description === "string") data.description = body.description.trim();
  if (body.value !== undefined) {
    const v = Number(body.value);
    if (Number.isFinite(v) && v > 0) data.value = v;
  }
  if (body.quota !== undefined) data.quota = Number(body.quota) || 0;
  if (body.endsAt) data.endsAt = new Date(body.endsAt);
  if (body.minOrder !== undefined) data.minOrder = Number(body.minOrder) || 0;
  if (body.maxDiscount !== undefined) data.maxDiscount = Number(body.maxDiscount) || 0;

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Tidak ada field untuk diupdate." }, { status: 400 });

  try {
    const promo = await db.promo.update({ where: { id: promoId }, data });
    await logAction({
      actorId: me.id, actorEmail: me.email, actorRole: me.role,
      category: "promo", action: "promo.update",
      description: `Promo ${promo.code} diperbarui. Fields: ${Object.keys(data).join(", ")}.`,
      targetId: promo.id, targetType: "promo", outcome: "success",
      ipAddress: meta.ipAddress, userAgent: meta.userAgent,
    });
    return NextResponse.json({ promo });
  } catch (err) {
    console.error("[admin/promos PATCH]", err);
    return NextResponse.json({ error: "Gagal update promo." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ promoId: string }> },
) {
  const me = await requireRole("ADMIN");
  if (!me) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const meta = getRequestMeta(req);
  const { promoId } = await params;

  try {
    const promo = await db.promo.delete({ where: { id: promoId } });
    await logAction({
      actorId: me.id, actorEmail: me.email, actorRole: me.role,
      category: "promo", action: "promo.delete",
      description: `Promo ${promo.code} dihapus oleh admin.`,
      targetId: promoId, targetType: "promo", outcome: "success",
      ipAddress: meta.ipAddress, userAgent: meta.userAgent,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/promos DELETE]", err);
    return NextResponse.json({ error: "Gagal hapus promo." }, { status: 500 });
  }
}
