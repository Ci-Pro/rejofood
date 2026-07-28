/**
 * GET /api/payment/status/[orderId]
 *
 * Customer lihat status payment untuk order-nya (payment terakhir yang aktif).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const me = await requireRole("CUSTOMER");
  if (!me) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { orderId } = await params;
  const customer = await db.customer.findUnique({ where: { userId: me.id } });
  if (!customer) {
    return NextResponse.json({ error: "Profil customer tidak ditemukan." }, { status: 404 });
  }

  // Verify ownership
  const order = await db.order.findFirst({
    where: { id: orderId, customerId: customer.id },
    select: { id: true, code: true, status: true, total: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  }

  // Ambil payment terbaru (orderBy createdAt desc)
  const payment = await db.payment.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });

  if (!payment) {
    return NextResponse.json({
      order,
      payment: null,
    });
  }

  return NextResponse.json({
    order,
    payment: {
      id: payment.id,
      code: payment.code,
      method: payment.method,
      status: payment.status,
      amount: payment.amount,
      paymentUrl: payment.paymentUrl,
      expiresAt: payment.expiresAt?.toISOString() ?? null,
      paidAt: payment.paidAt?.toISOString() ?? null,
      metadata: payment.gatewayMetadata ? JSON.parse(payment.gatewayMetadata) : null,
      createdAt: payment.createdAt.toISOString(),
    },
  });
}
