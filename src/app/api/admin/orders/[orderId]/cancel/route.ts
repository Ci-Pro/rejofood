/**
 * POST /api/admin/orders/[orderId]/cancel
 *
 * Admin: cancel any order + force refund if payment was successful.
 * Body: { reason?: string }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { emitOrderStatusChange } from "@/lib/realtime/realtime-client";
import { creditWallet } from "@/lib/wallet/wallet-service";
import { OrderStatus, PaymentStatus } from "@prisma/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const me = await requireRole("ADMIN");
  if (!me) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const meta = getRequestMeta(req);
  const { orderId } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = body?.reason ? String(body.reason).trim().slice(0, 300) : "Cancelled by admin";

  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        merchant: { select: { userId: true, restaurantName: true } },
        customer: { select: { userId: true } },
        driver: { select: { userId: true } },
        payments: { where: { status: "SUCCESS" }, take: 1 },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
    }

    if (order.status === "DELIVERED") {
      return NextResponse.json({ error: "Order sudah selesai. Tidak bisa dibatalkan." }, { status: 400 });
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json({ error: "Order sudah dibatalkan." }, { status: 400 });
    }

    const now = new Date();

    // Update order status
    const updated = await db.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: now,
        notes: `${order.notes ?? ""}\n[ADMIN CANCEL: ${reason}]`.trim(),
      },
    });

    // Refund payment if successful
    const successfulPayment = order.payments[0];
    let refunded = false;
    if (successfulPayment) {
      await db.payment.update({
        where: { id: successfulPayment.id },
        data: { status: PaymentStatus.REFUNDED, refundedAt: now },
      });
      refunded = true;

      // Refund to wallet if WALLET payment
      if (successfulPayment.method === "WALLET") {
        try {
          await creditWallet({
            userId: order.customer.userId,
            amount: successfulPayment.amount,
            type: "REFUND",
            description: `Admin refund order ${order.code}`,
            orderId: order.id,
            metadata: { paymentCode: successfulPayment.code, reason },
          });
        } catch (err) {
          console.error("[admin cancel] wallet refund failed:", err);
        }
      }
    }

    await logAction({
      actorId: me.id,
      actorEmail: me.email,
      actorRole: me.role,
      category: "admin",
      action: "admin.order.cancel",
      description: `Order ${order.code} dibatalkan oleh admin. Reason: ${reason}. Refunded: ${refunded}.`,
      targetId: order.id,
      targetType: "order",
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { orderCode: order.code, reason, refunded, paymentMethod: successfulPayment?.method ?? null },
    });

    // Realtime notify
    await emitOrderStatusChange({
      orderId: order.id,
      code: order.code,
      from: order.status,
      to: "CANCELLED",
      customerUserId: order.customer.userId,
      merchantUserId: order.merchant.userId,
      driverUserId: order.driver?.userId ?? null,
      actorRole: "ADMIN",
    });

    return NextResponse.json({
      order: {
        id: updated.id,
        code: updated.code,
        status: updated.status,
        cancelledAt: updated.cancelledAt?.toISOString(),
      },
      refunded,
    });
  } catch (err) {
    console.error("[admin/orders/cancel]", err);
    return NextResponse.json({ error: "Gagal membatalkan order." }, { status: 500 });
  }
}
