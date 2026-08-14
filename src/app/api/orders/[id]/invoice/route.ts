/**
 * GET /api/orders/[id]/invoice
 * Return order detail formatted as invoice/receipt data.
 * Customer can view/download for their records.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";

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

  const order = await db.order.findFirst({
    where: { id, customerId: customer.id },
    include: {
      merchant: { select: { restaurantName: true, address: true, cuisine: true } },
      driver: { select: { user: { select: { fullName: true } } } },
      items: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { method: true, status: true, code: true, paidAt: true },
      },
      review: { select: { rating: true, comment: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  }

  const payment = order.payments[0];
  const methodLabel: Record<string, string> = {
    COD: "Cash (COD)",
    QRIS: "QRIS",
    VA_BCA: "VA BCA",
    VA_MANDIRI: "VA Mandiri",
    VA_BNI: "VA BNI",
    EWALLET_GOPAY: "GoPay",
    EWALLET_OVO: "OVO",
    EWALLET_DANA: "DANA",
  };

  return NextResponse.json({
    invoice: {
      code: order.code,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      merchant: {
        name: order.merchant.restaurantName,
        address: order.merchant.address,
        cuisine: order.merchant.cuisine,
      },
      driver: order.driver ? { name: order.driver.user.fullName } : null,
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      })),
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      total: order.total,
      deliveryAddress: order.deliveryAddress,
      notes: order.notes,
      payment: payment ? {
        method: methodLabel[payment.method] ?? payment.method,
        status: payment.status,
        code: payment.code,
        paidAt: payment.paidAt?.toISOString() ?? null,
      } : null,
      review: order.review ? {
        rating: order.review.rating,
        comment: order.review.comment,
      } : null,
    },
  });
}
