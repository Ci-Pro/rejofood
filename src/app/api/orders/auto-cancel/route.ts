/**
 * POST /api/orders/auto-cancel
 *
 * Auto-cancel orders yang PENDING >15 menit tanpa payment SUCCESS.
 * Dipanggil saat:
 *  - Customer akses /api/orders (lazy cleanup)
 *  - Merchant akses /api/merchant/orders
 *  - Cron job (production: Vercel Cron / external scheduler)
 *
 * Logic:
 *  - Cari orders dengan status PENDING + createdAt < 15 menit lalu
 *  - Cek payment terakhir: jika PENDING atau tidak ada → cancel
 *  - Jika payment SUCCESS tapi order masih PENDING → biarkan (merchant belum accept)
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAction } from "@/lib/auth/audit";
import { OrderStatus } from "@prisma/client";

const AUTO_CANCEL_MINUTES = 15;

export async function POST() {
  const cutoff = new Date(Date.now() - AUTO_CANCEL_MINUTES * 60 * 1000);

  // Find PENDING orders older than cutoff
  const staleOrders = await db.order.findMany({
    where: {
      status: OrderStatus.PENDING,
      createdAt: { lt: cutoff },
    },
    include: {
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      customer: { select: { userId: true } },
      merchant: { select: { userId: true } },
    },
  });

  let cancelled = 0;

  for (const order of staleOrders) {
    const latestPayment = order.payments[0];
    // If payment SUCCESS, don't auto-cancel (waiting merchant accept)
    if (latestPayment?.status === "SUCCESS") continue;
    // If no payment at all, or payment PENDING/FAILED → cancel

    await db.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        notes: (order.notes ?? "") + "\n[AUTO-CANCELLED: Tidak ada pembayaran dalam 15 menit]",
      },
    });

    // If payment PENDING, mark as FAILED
    if (latestPayment && latestPayment.status === "PENDING") {
      await db.payment.update({
        where: { id: latestPayment.id },
        data: { status: "FAILED", failedAt: new Date() },
      });
    }

    await logAction({
      actorEmail: "system@auto-cancel",
      category: "order",
      action: "order.auto_cancelled",
      description: `Order ${order.code} auto-cancelled: tidak ada pembayaran dalam ${AUTO_CANCEL_MINUTES} menit.`,
      targetId: order.id,
      targetType: "order",
      outcome: "success",
      metadata: {
        code: order.code,
        from: "PENDING",
        to: "CANCELLED",
        reason: "payment_timeout",
        minutesElapsed: Math.round((Date.now() - order.createdAt.getTime()) / 60000),
      },
    });

    cancelled++;
  }

  return NextResponse.json({ cancelled, checked: staleOrders.length });
}
