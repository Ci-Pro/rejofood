/**
 * POST /api/driver/orders/[id]/deliver
 *
 * Driver mark order as delivered: PICKED_UP → DELIVERED.
 * Hanya driver yang sudah assign ke order ini yang bisa complete.
 *
 * Pada DELIVERED:
 *  - Credit driver earning (deliveryFee) ke wallet driver
 *  - Credit merchant settlement (subtotal) ke wallet merchant
 *  - COD orders: customer bayar cash ke driver, driver terima full total
 *    (subtotal ditahan merchant, deliveryFee ditahan driver — driver yang menanggung)
 *    Untuk MVP: COD credit subtotal ke merchant wallet, deliveryFee tetap ke driver wallet
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { emitOrderStatusChange, emitRealtime } from "@/lib/realtime/realtime-client";
import { sendOrderStatusPush } from "@/lib/push";
import { creditWallet } from "@/lib/wallet/wallet-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireRole("DRIVER");
  if (!me) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const meta = getRequestMeta(req);
  const { id } = await params;

  const driver = await db.driver.findUnique({ where: { userId: me.id } });
  if (!driver) {
    return NextResponse.json({ error: "Profil driver tidak ditemukan." }, { status: 404 });
  }

  // Verify ownership + include payment untuk settlement logic
  const order = await db.order.findFirst({
    where: { id, driverId: driver.id },
    include: {
      payments: { where: { status: "SUCCESS" }, orderBy: { createdAt: "desc" }, take: 1 },
      merchant: { select: { userId: true, restaurantName: true } },
      customer: { select: { userId: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan atau bukan milik Anda." }, { status: 404 });
  }
  if (order.status !== "PICKED_UP") {
    return NextResponse.json({ error: `Order status saat ini: ${order.status}. Harus PICKED_UP untuk deliver.` }, { status: 400 });
  }

  const updated = await db.order.update({
    where: { id },
    data: { status: "DELIVERED", deliveredAt: new Date() },
    include: {
      customer: { select: { userId: true } },
      merchant: { select: { userId: true } },
    },
  });

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "order",
    action: "order.status_change",
    description: `Order ${order.code}: PICKED_UP → DELIVERED oleh ${me.fullName}.`,
    targetId: order.id,
    targetType: "order",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { code: order.code, from: "PICKED_UP", to: "DELIVERED" },
  });

  // 💰 Settlement: credit earning ke wallet driver & merchant
  const successfulPayment = order.payments[0] ?? null;
  const isPaid = !!successfulPayment; // pembayaran online (bukan COD pending)
  const paymentMethod = successfulPayment?.method ?? null;
  const driverEarning = order.deliveryFee;
  const merchantEarning = order.subtotal;
  const settlementResults = { driver: false, merchant: false };

  // Driver selalu dapat deliveryFee dari order yang di-deliver (kecuali order cancelled)
  try {
    await creditWallet({
      userId: me.id,
      amount: driverEarning,
      type: "EARNING",
      description: `Earning antar order ${order.code}`,
      orderId: order.id,
      metadata: {
        orderCode: order.code,
        role: "DRIVER",
        earningType: "DELIVERY_FEE",
        amount: driverEarning,
      },
    });
    settlementResults.driver = true;
    await logAction({
      actorId: me.id,
      actorEmail: me.email,
      actorRole: me.role,
      category: "wallet",
      action: "wallet.earning.driver",
      description: `Driver earning Rp ${driverEarning.toLocaleString("id-ID")} dari order ${order.code} dikredit ke wallet.`,
      targetId: order.id,
      targetType: "order",
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { orderCode: order.code, amount: driverEarning, role: "DRIVER" },
    });
  } catch (err) {
    console.error("[deliver] driver earning credit failed:", err);
  }

  // Merchant dapat subtotal jika pembayaran online (QRIS/VA/Wallet) atau COD.
  // Untuk COD: customer bayar cash ke driver, tapi merchant tetap dapat subtotal via wallet
  // (driver "menyetorkan" ke merchant — di MVP, sistem auto-settle untuk simplifikasi).
  if (isPaid || paymentMethod === "COD") {
    try {
      await creditWallet({
        userId: order.merchant.userId,
        amount: merchantEarning,
        type: "EARNING",
        description: `Penjualan order ${order.code}`,
        orderId: order.id,
        metadata: {
          orderCode: order.code,
          role: "MERCHANT",
          earningType: "SUBTOTAL",
          amount: merchantEarning,
          paymentMethod: paymentMethod ?? "UNKNOWN",
        },
      });
      settlementResults.merchant = true;
      await logAction({
        actorId: me.id,
        actorEmail: me.email,
        actorRole: me.role,
        category: "wallet",
        action: "wallet.earning.merchant",
        description: `Merchant settlement Rp ${merchantEarning.toLocaleString("id-ID")} dari order ${order.code} dikredit ke wallet.`,
        targetId: order.id,
        targetType: "order",
        outcome: "success",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { orderCode: order.code, amount: merchantEarning, role: "MERCHANT" },
      });
    } catch (err) {
      console.error("[deliver] merchant earning credit failed:", err);
    }
  }

  // 🔔 Realtime: notify customer + merchant + admin (+ driver wallet update)
  await emitOrderStatusChange({
    orderId: order.id,
    code: order.code,
    from: "PICKED_UP",
    to: "DELIVERED",
    customerUserId: updated.customer.userId,
    merchantUserId: updated.merchant.userId,
    driverUserId: driver.userId,
    actorRole: "DRIVER",
  });

  // Emit wallet:updated ke driver + merchant (soalnya saldo baru saja berubah)
  if (settlementResults.driver || settlementResults.merchant) {
    await emitRealtime({
      event: "order:updated",
      rooms: [
        ...(settlementResults.driver ? [`user:${driver.userId}`] : []),
        ...(settlementResults.merchant ? [`user:${updated.merchant.userId}`] : []),
      ],
      data: {
        type: "WALLET_UPDATED",
        orderCode: order.code,
        driverEarning,
        merchantEarning,
        timestamp: new Date().toISOString(),
      },
    }).catch(() => {});
  }

  // 🔔 Push notification
  sendOrderStatusPush({
    orderCode: order.code,
    from: "PICKED_UP",
    to: "DELIVERED",
    customerUserId: updated.customer.userId,
    merchantUserId: updated.merchant.userId,
    driverUserId: driver.userId,
    actorRole: "DRIVER",
  }).catch(() => {});

  return NextResponse.json({
    order: {
      id: updated.id,
      code: updated.code,
      status: updated.status,
      deliveredAt: updated.deliveredAt?.toISOString(),
    },
    settlement: {
      driverEarning,
      merchantEarning,
      driverCredited: settlementResults.driver,
      merchantCredited: settlementResults.merchant,
    },
  });
}
