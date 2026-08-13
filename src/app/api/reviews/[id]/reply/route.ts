/**
 * POST /api/reviews/[id]/reply
 *
 * Merchant reply to a customer review.
 * - Merchant-only (requireRole MERCHANT)
 * - Ownership check: review must belong to merchant's restaurant
 * - One reply per review (if already replied, return 400)
 * - Body: { reply: string } — maks 500 char
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireRole("MERCHANT");
  if (!me) {
    return NextResponse.json({ error: "Forbidden. Hanya merchant." }, { status: 403 });
  }

  const meta = getRequestMeta(req);
  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!body?.reply || typeof body.reply !== "string") {
    return NextResponse.json({ error: "Reply wajib diisi." }, { status: 400 });
  }

  const reply = body.reply.trim();
  if (reply.length < 2) {
    return NextResponse.json({ error: "Reply minimal 2 karakter." }, { status: 400 });
  }
  if (reply.length > 500) {
    return NextResponse.json({ error: "Reply maksimal 500 karakter." }, { status: 400 });
  }

  // Find merchant profile
  const merchant = await db.merchant.findUnique({ where: { userId: me.id } });
  if (!merchant) {
    return NextResponse.json({ error: "Profil merchant tidak ditemukan." }, { status: 404 });
  }

  // Find review with ownership check
  const review = await db.review.findFirst({
    where: { id, merchantId: merchant.id },
    include: {
      customer: { select: { user: { select: { fullName: true } } } },
      order: { select: { code: true } },
    },
  });
  if (!review) {
    return NextResponse.json({ error: "Review tidak ditemukan." }, { status: 404 });
  }

  // Check if already replied
  if (review.merchantReply) {
    return NextResponse.json(
      { error: "Kamu sudah membalas review ini." },
      { status: 400 },
    );
  }

  // Update review with reply
  const updated = await db.review.update({
    where: { id: review.id },
    data: {
      merchantReply: reply,
      merchantReplyAt: new Date(),
    },
  });

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "review",
    action: "review.reply",
    description: `Merchant ${me.fullName} membalas review ${review.order.code} (rating ${review.rating}★).`,
    targetId: review.id,
    targetType: "review",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      reviewId: review.id,
      orderCode: review.order.code,
      customerName: review.customer.user.fullName,
      rating: review.rating,
      reply: reply.slice(0, 100),
    },
  });

  return NextResponse.json({
    review: {
      id: updated.id,
      merchantReply: updated.merchantReply,
      merchantReplyAt: updated.merchantReplyAt?.toISOString() ?? null,
    },
  });
}
