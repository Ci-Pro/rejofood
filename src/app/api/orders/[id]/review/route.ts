/**
 * POST /api/orders/[id]/review
 *
 * Customer submit review untuk order yang sudah DELIVERED.
 * - Ownership check: order harus milik customer yang login
 * - Status check: order harus DELIVERED
 * - One review per order: unique constraint orderId
 * - Rating 1-5 (integer)
 * - Comment optional, maks 500 char
 * - Auto-recompute merchant.rating (avg dari semua review merchant)
 *
 * GET /api/orders/[id]/review — get existing review for this order (customer only)
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { emitRealtime } from "@/lib/realtime/realtime-client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireRole("CUSTOMER");
  if (!me) {
    return NextResponse.json({ error: "Forbidden. Hanya customer." }, { status: 403 });
  }

  const meta = getRequestMeta(req);
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.rating !== "number") {
    return NextResponse.json({ error: "rating wajib diisi (1-5)." }, { status: 400 });
  }

  const rating = Math.floor(body.rating);
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating harus 1-5." }, { status: 400 });
  }

  const comment = body.comment ? String(body.comment).trim().slice(0, 500) : null;

  // Find customer + order
  const customer = await db.customer.findUnique({ where: { userId: me.id } });
  if (!customer) {
    return NextResponse.json({ error: "Profil customer tidak ditemukan." }, { status: 404 });
  }

  const order = await db.order.findFirst({
    where: { id, customerId: customer.id },
    include: { review: true, merchant: { select: { id: true, userId: true, restaurantName: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  }

  if (order.status !== "DELIVERED") {
    return NextResponse.json(
      { error: `Review hanya bisa untuk order DELIVERED. Status saat ini: ${order.status}.` },
      { status: 400 },
    );
  }

  if (order.review) {
    return NextResponse.json(
      { error: "Order ini sudah pernah di-review." },
      { status: 400 },
    );
  }

  // Create review
  const review = await db.review.create({
    data: {
      orderId: order.id,
      customerId: customer.id,
      merchantId: order.merchantId,
      rating,
      comment,
    },
  });

  // Auto-recompute merchant rating (avg of all reviews)
  const reviews = await db.review.findMany({
    where: { merchantId: order.merchantId },
    select: { rating: true },
  });
  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  await db.merchant.update({
    where: { id: order.merchantId },
    data: { rating: avgRating },
  });

  // Audit log
  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "review",
    action: "review.create",
    description: `Review ${rating}★ dibuat untuk order ${order.code} (${order.merchant.restaurantName})${comment ? `: "${comment.slice(0, 60)}"` : ""}.`,
    targetId: review.id,
    targetType: "review",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      reviewId: review.id,
      orderCode: order.code,
      merchantName: order.merchant.restaurantName,
      rating,
      newMerchantRating: avgRating,
      totalReviews: reviews.length,
    },
  });

  // 🔔 Realtime: notify merchant + admin
  await emitRealtime({
    event: "order:updated",
    rooms: [`user:${order.merchant.userId}`, "role:admin"],
    data: {
      orderId: order.id,
      code: order.code,
      reviewId: review.id,
      rating,
      newMerchantRating: avgRating,
      timestamp: new Date().toISOString(),
    },
  });

  return NextResponse.json({
    review: {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    },
    merchantRating: avgRating,
    totalReviews: reviews.length,
  }, { status: 201 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireRole("CUSTOMER");
  if (!me) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const customer = await db.customer.findUnique({ where: { userId: me.id } });
  if (!customer) {
    return NextResponse.json({ error: "Profil customer tidak ditemukan." }, { status: 404 });
  }

  // Verify ownership
  const order = await db.order.findFirst({
    where: { id, customerId: customer.id },
    select: { id: true, status: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  }

  const review = await db.review.findUnique({
    where: { orderId: id },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ review, orderStatus: order.status });
}
