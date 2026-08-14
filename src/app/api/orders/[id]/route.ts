/**
 * GET /api/orders/[id]
 * Detail order milik customer yang sedang login.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
        merchant: { select: { id: true, restaurantName: true, address: true, cuisine: true, prepTime: true } },
        driver: { select: { id: true, user: { select: { fullName: true } } } },
        items: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({
      order: {
        id: order.id,
        code: order.code,
        status: order.status,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        discountAmount: order.discountAmount,
        promoCode: order.promoCode,
        total: order.total,
        deliveryAddress: order.deliveryAddress,
        notes: order.notes,
        createdAt: order.createdAt.toISOString(),
        acceptedAt: order.acceptedAt?.toISOString() ?? null,
        readyAt: order.readyAt?.toISOString() ?? null,
        pickedUpAt: order.pickedUpAt?.toISOString() ?? null,
        deliveredAt: order.deliveredAt?.toISOString() ?? null,
        cancelledAt: order.cancelledAt?.toISOString() ?? null,
        merchant: order.merchant,
        driver: order.driver ? { id: order.driver.id, name: order.driver.user.fullName } : null,
        items: order.items,
      },
    });
  } catch (err) {
    console.error("[orders/[id]] error:", err);
    return NextResponse.json(
      { error: "Gagal memuat detail pesanan." },
      { status: 500 },
    );
  }
}
