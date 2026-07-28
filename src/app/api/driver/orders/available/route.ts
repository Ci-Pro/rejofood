/**
 * GET /api/driver/orders/available
 *
 * List order berstatus READY yang siap dijemput oleh driver.
 * Driver yang sedang login bisa lihat semua READY orders (race: siapa cepat dia dapat).
 *
 * Juga include active delivery milik driver ini (PICKED_UP).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";

export async function GET() {
  const me = await requireRole("DRIVER");
  if (!me) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const driver = await db.driver.findUnique({ where: { userId: me.id } });
  if (!driver) {
    return NextResponse.json({ error: "Profil driver tidak ditemukan." }, { status: 404 });
  }

  // Available orders: READY status, belum ada driver
  const [available, active] = await Promise.all([
    db.order.findMany({
      where: { status: "READY", driverId: null },
      orderBy: { readyAt: "asc" },
      include: {
        merchant: { select: { id: true, restaurantName: true, address: true } },
        customer: { select: { id: true, user: { select: { fullName: true, phone: true } } } },
        items: true,
      },
    }),
    db.order.findMany({
      where: { driverId: driver.id, status: "PICKED_UP" },
      orderBy: { pickedUpAt: "asc" },
      include: {
        merchant: { select: { id: true, restaurantName: true, address: true } },
        customer: { select: { id: true, user: { select: { fullName: true, phone: true } } } },
        items: true,
      },
    }),
  ]);

  const mapOrder = (o: typeof available[number]) => ({
    id: o.id,
    code: o.code,
    status: o.status,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    deliveryAddress: o.deliveryAddress,
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
    readyAt: o.readyAt?.toISOString() ?? null,
    pickedUpAt: o.pickedUpAt?.toISOString() ?? null,
    merchant: o.merchant,
    customer: {
      id: o.customer.id,
      name: o.customer.user.fullName,
      phone: o.customer.user.phone,
    },
    items: o.items,
    itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
  });

  return NextResponse.json({
    available: available.map(mapOrder),
    active: active.map(mapOrder),
  });
}
