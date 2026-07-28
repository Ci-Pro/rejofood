/**
 * POST /api/payment/mock-notify
 *
 * Mock webhook simulator. Di production, endpoint ini akan dipanggil oleh gateway (Midtrans/Xendit).
 *
 * Di dev: customer/UI bisa POST ke sini untuk simulasi "saya sudah bayar".
 *
 * Body: { paymentCode: string, transactionStatus: "settlement" | "deny" | "expire" }
 *
 * Logic:
 *  - Cari payment by code
 *  - Verify masih PENDING (tidak bisa ubah jika sudah SUCCESS/FAILED/REFUNDED)
 *  - Cek expiry (kalau lewat, force FAILED)
 *  - Update status + timestamp
 *  - Audit + realtime emit
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { emitRealtime } from "@/lib/realtime/realtime-client";
import { mapGatewayStatus } from "@/lib/payment/gateway";
import { PaymentStatus } from "@prisma/client";

export async function POST(req: Request) {
  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body?.paymentCode || !body?.transactionStatus) {
    return NextResponse.json(
      { error: "paymentCode dan transactionStatus wajib diisi." },
      { status: 400 },
    );
  }

  const { paymentCode, transactionStatus } = body as {
    paymentCode: string;
    transactionStatus: "settlement" | "deny" | "expire" | "cancel";
  };

  const payment = await db.payment.findUnique({
    where: { code: paymentCode },
    include: {
      order: {
        select: {
          id: true,
          code: true,
          merchant: { select: { userId: true } },
          customer: { select: { userId: true } },
        },
      },
    },
  });
  if (!payment) {
    return NextResponse.json({ error: "Payment tidak ditemukan." }, { status: 404 });
  }

  if (payment.status !== PaymentStatus.PENDING) {
    return NextResponse.json(
      { error: `Payment status saat ini: ${payment.status}. Tidak bisa diubah dari PENDING.` },
      { status: 400 },
    );
  }

  // Cek expiry
  if (payment.expiresAt && new Date(payment.expiresAt) < new Date()) {
    const expired = await db.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
      },
    });
    await logAction({
      actorEmail: "system@gateway",
      category: "payment",
      action: "payment.expired",
      description: `Payment ${payment.code} expired (lewat dari ${payment.expiresAt.toISOString()}).`,
      targetId: payment.id,
      targetType: "payment",
      outcome: "failure",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return NextResponse.json(
      { error: "Payment sudah expired.", payment: { code: expired.code, status: expired.status } },
      { status: 400 },
    );
  }

  const newStatus = mapGatewayStatus(transactionStatus);

  // Update payment
  const updateData: Record<string, unknown> = { status: newStatus };
  const now = new Date();
  if (newStatus === PaymentStatus.SUCCESS) updateData.paidAt = now;
  else if (newStatus === PaymentStatus.FAILED) updateData.failedAt = now;

  const updated = await db.payment.update({
    where: { id: payment.id },
    data: updateData,
  });

  // Audit log
  const actionName = newStatus === PaymentStatus.SUCCESS
    ? "payment.success"
    : newStatus === PaymentStatus.FAILED
      ? "payment.failed"
      : "payment.update";
  await logAction({
    actorEmail: "system@gateway",
    category: "payment",
    action: actionName,
    description: `Payment ${payment.code} (${payment.method}) → ${newStatus} via gateway webhook.`,
    targetId: payment.id,
    targetType: "payment",
    outcome: newStatus === PaymentStatus.SUCCESS ? "success" : "failure",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      paymentCode: payment.code,
      orderCode: payment.order.code,
      method: payment.method,
      amount: payment.amount,
      gatewayStatus: transactionStatus,
      newStatus,
    },
  });

  // 🔔 Realtime: notify customer + merchant + admin
  await emitRealtime({
    event: "order:status",
    rooms: [
      `user:${payment.order.customer.userId}`,
      `user:${payment.order.merchant.userId}`,
      "role:admin",
    ],
    data: {
      orderId: payment.order.id,
      code: payment.order.code,
      from: "PAYMENT_PENDING",
      to: newStatus === PaymentStatus.SUCCESS ? "PAID" : newStatus,
      actorRole: "SYSTEM",
      paymentMethod: payment.method,
      timestamp: now.toISOString(),
    },
  });

  return NextResponse.json({
    payment: {
      id: updated.id,
      code: updated.code,
      status: updated.status,
      paidAt: updated.paidAt?.toISOString() ?? null,
      failedAt: updated.failedAt?.toISOString() ?? null,
    },
  });
}
