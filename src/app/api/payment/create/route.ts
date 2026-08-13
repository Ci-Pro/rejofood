/**
 * POST /api/payment/create
 *
 * Buat payment record baru untuk order yang sudah ada (status PENDING).
 * Dipanggil setelah customer checkout (atau retry payment jika sebelumnya gagal).
 *
 * Body: { orderId, method: PaymentMethod }
 *
 * Logic:
 *  - Verify customer ownership
 *  - Verify order exists + status PENDING
 *  - Cek apakah sudah ada payment SUCCESS — jika ya, tolak
 *  - Create payment via mock gateway
 *  - Simpan Payment record ke DB
 *  - Jika COD: langsung set SUCCESS + emit order:status (unlock merchant accept)
 *  - Jika WALLET: debit saldo atomic + langsung SUCCESS + emit order:status
 *  - Audit + realtime emit
 *
 * Returns: { payment: { id, code, method, status, paymentUrl, expiresAt, metadata } }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { emitRealtime } from "@/lib/realtime/realtime-client";
import { createPaymentCharge, isCOD, methodLabel } from "@/lib/payment/gateway";
import { debitWallet } from "@/lib/wallet/wallet-service";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

function generatePaymentCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "PAY-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function POST(req: Request) {
  const me = await requireRole("CUSTOMER");
  if (!me) {
    return NextResponse.json({ error: "Forbidden. Hanya customer." }, { status: 403 });
  }

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body?.orderId || !body?.method) {
    return NextResponse.json({ error: "orderId dan method wajib diisi." }, { status: 400 });
  }

  const method = body.method as PaymentMethod;
  if (!Object.values(PaymentMethod).includes(method)) {
    return NextResponse.json({ error: "Method tidak valid." }, { status: 400 });
  }

  // Cari customer profile + order dengan ownership check
  const customer = await db.customer.findUnique({ where: { userId: me.id } });
  if (!customer) {
    return NextResponse.json({ error: "Profil customer tidak ditemukan." }, { status: 404 });
  }

  const order = await db.order.findFirst({
    where: { id: body.orderId, customerId: customer.id },
    include: { payments: true, merchant: { select: { userId: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  }

  if (order.status !== "PENDING") {
    return NextResponse.json(
      { error: `Order status saat ini: ${order.status}. Payment hanya bisa dibuat untuk order PENDING.` },
      { status: 400 },
    );
  }

  // Cek apakah sudah ada payment SUCCESS
  const existingSuccess = order.payments.find((p) => p.status === "SUCCESS");
  if (existingSuccess) {
    return NextResponse.json(
      { error: "Order ini sudah dibayar. Tidak bisa buat payment baru." },
      { status: 400 },
    );
  }

  // Generate unique code
  let paymentCode = generatePaymentCode();
  for (let i = 0; i < 5; i++) {
    const existing = await db.payment.findUnique({ where: { code: paymentCode } });
    if (!existing) break;
    paymentCode = generatePaymentCode();
  }

  // Create charge via gateway
  const charge = await createPaymentCharge({
    paymentCode,
    orderId: order.id,
    orderCode: order.code,
    amount: order.total,
    method,
    customerName: me.fullName,
    customerEmail: me.email,
  });

  // COD = langsung SUCCESS; WALLET = debit atomic + SUCCESS; online methods = PENDING
  let initialStatus: PaymentStatus;
  let walletTxCode: string | null = null;
  if (isCOD(method)) {
    initialStatus = PaymentStatus.SUCCESS;
  } else if (method === PaymentMethod.WALLET) {
    // Debit saldo RejoPay secara atomic
    try {
      const walletTx = await debitWallet({
        userId: me.id,
        amount: order.total,
        type: "PAYMENT",
        description: `Bayar order ${order.code}`,
        orderId: order.id,
        gatewayReference: charge.gatewayReference,
        metadata: { paymentCode, orderCode: order.code, method: "WALLET" },
      });
      walletTxCode = walletTx.code;
      initialStatus = PaymentStatus.SUCCESS;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Gagal debit wallet";
      await logAction({
        actorId: me.id,
        actorEmail: me.email,
        actorRole: me.role,
        category: "payment",
        action: "payment.wallet.failed",
        description: `Wallet payment gagal untuk order ${order.code}: ${errMsg}`,
        targetId: order.id,
        targetType: "order",
        outcome: "failure",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { orderCode: order.code, error: errMsg },
      });
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }
  } else {
    initialStatus = PaymentStatus.PENDING;
  }

  const payment = await db.payment.create({
    data: {
      code: paymentCode,
      orderId: order.id,
      customerId: customer.id,
      method,
      status: initialStatus,
      amount: order.total,
      gatewayReference: charge.gatewayReference,
      paymentUrl: charge.paymentUrl,
      gatewayMetadata: JSON.stringify(charge.metadata),
      expiresAt: charge.expiresAt,
      ...(initialStatus === PaymentStatus.SUCCESS && { paidAt: new Date() }),
    },
  });

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "payment",
    action: "payment.create",
    description: `Payment ${payment.code} dibuat untuk order ${order.code} via ${methodLabel(method)} (${initialStatus}).`,
    targetId: payment.id,
    targetType: "payment",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      paymentCode: payment.code,
      orderCode: order.code,
      method,
      amount: order.total,
      initialStatus,
      gatewayReference: charge.gatewayReference,
    },
  });

  // 🔔 Realtime: notify merchant (+ admin) — payment status update
  await emitRealtime({
    event: "order:updated",
    rooms: [`user:${order.merchant.userId}`, "role:admin", `user:${me.id}`],
    data: {
      orderId: order.id,
      code: order.code,
      paymentCode: payment.code,
      paymentStatus: initialStatus,
      method,
      timestamp: new Date().toISOString(),
    },
  });

  // Kalau COD/WALLET = SUCCESS, log audit + emit payment.success
  if (initialStatus === PaymentStatus.SUCCESS) {
    await logAction({
      actorId: me.id,
      actorEmail: me.email,
      actorRole: me.role,
      category: "payment",
      action: "payment.success",
      description: `Payment ${payment.code} (${methodLabel(method)}) berhasil untuk order ${order.code}.`,
      targetId: payment.id,
      targetType: "payment",
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { paymentCode: payment.code, orderCode: order.code, method, walletTxCode },
    });
    await emitRealtime({
      event: "order:status",
      rooms: [`user:${order.merchant.userId}`, "role:admin", `user:${me.id}`],
      data: {
        orderId: order.id,
        code: order.code,
        from: "PAYMENT_PENDING",
        to: "PAID",
        actorRole: "CUSTOMER",
        paymentMethod: method,
        timestamp: new Date().toISOString(),
      },
    });
  }

  return NextResponse.json({
    payment: {
      id: payment.id,
      code: payment.code,
      method: payment.method,
      status: payment.status,
      amount: payment.amount,
      paymentUrl: payment.paymentUrl,
      expiresAt: payment.expiresAt?.toISOString() ?? null,
      paidAt: payment.paidAt?.toISOString() ?? null,
      metadata: charge.metadata,
    },
  }, { status: 201 });
}
