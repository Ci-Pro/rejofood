/**
 * POST /api/wallet/topup/confirm
 *
 * Mock gateway webhook untuk top-up wallet.
 * Customer klik "Saya sudah bayar" → endpoint ini dipanggil.
 *
 * Body: { txCode: string, transactionStatus: "settlement" | "deny" | "expire" }
 *
 * Logic:
 *  1. Cari WalletTransaction by code
 *  2. Verify type=TOPUP + status=PENDING
 *  3. Cek expiry
 *  4. Jika settlement: credit saldo + mark SUCCESS + emit realtime
 *  5. Jika deny/expire: mark FAILED (saldo tidak berubah)
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { emitRealtime } from "@/lib/realtime/realtime-client";
import { WalletTxStatus } from "@prisma/client";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body?.txCode || !body?.transactionStatus) {
    return NextResponse.json(
      { error: "txCode dan transactionStatus wajib diisi." },
      { status: 400 },
    );
  }

  const { txCode, transactionStatus } = body as {
    txCode: string;
    transactionStatus: "settlement" | "deny" | "expire" | "cancel";
  };

  const tx = await db.walletTransaction.findUnique({
    where: { code: txCode },
    include: { wallet: true },
  });
  if (!tx) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
  }
  if (tx.wallet.userId !== me.id) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }
  if (tx.type !== "TOPUP") {
    return NextResponse.json(
      { error: "Transaksi ini bukan top-up." },
      { status: 400 },
    );
  }
  if (tx.status !== WalletTxStatus.PENDING) {
    return NextResponse.json(
      { error: `Transaksi sudah ${tx.status}.` },
      { status: 400 },
    );
  }

  // Parse expiry dari metadata
  const metaObj = tx.metadata ? JSON.parse(tx.metadata) : {};
  const expiresAt = metaObj.expiresAt ? new Date(metaObj.expiresAt) : null;

  // Cek expiry
  if (expiresAt && expiresAt < new Date() && transactionStatus === "settlement") {
    await db.walletTransaction.update({
      where: { id: tx.id },
      data: { status: WalletTxStatus.FAILED },
    });
    await logAction({
      actorId: me.id,
      actorEmail: me.email,
      actorRole: me.role,
      category: "wallet",
      action: "wallet.topup.expired",
      targetId: tx.id,
      targetType: "wallet_transaction",
      description: `Top-up ${tx.code} expired.`,
      outcome: "failure",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return NextResponse.json(
      { error: "Top-up sudah expired. Silakan buat ulang." },
      { status: 400 },
    );
  }

  if (transactionStatus === "settlement") {
    // Credit saldo + mark SUCCESS
    const newBalance = await db.$transaction(async (dbTx) => {
      const wallet = await dbTx.wallet.findUnique({ where: { id: tx.walletId } });
      if (!wallet) throw new Error("Wallet tidak ditemukan");

      const next = wallet.balance + tx.amount;
      await Promise.all([
        dbTx.wallet.update({
          where: { id: wallet.id },
          data: { balance: next },
        }),
        dbTx.walletTransaction.update({
          where: { id: tx.id },
          data: {
            status: WalletTxStatus.SUCCESS,
            balanceAfter: next,
          },
        }),
      ]);
      return next;
    });

    await logAction({
      actorId: me.id,
      actorEmail: me.email,
      actorRole: me.role,
      category: "wallet",
      action: "wallet.topup.success",
      targetId: tx.id,
      targetType: "wallet_transaction",
      description: `Top-up ${tx.code} berhasil. Saldo +Rp ${tx.amount.toLocaleString("id-ID")} → Rp ${newBalance.toLocaleString("id-ID")}`,
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { txCode: tx.code, amount: tx.amount, newBalance },
    });

    // Emit realtime ke customer (pakai event "order:updated" karena list event dibatasi)
    await emitRealtime({
      event: "order:updated",
      rooms: [`user:${me.id}`],
      data: {
        type: "WALLET_UPDATED",
        txCode: tx.code,
        walletTxType: "TOPUP",
        status: "SUCCESS",
        amount: tx.amount,
        newBalance,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      txCode: tx.code,
      status: "SUCCESS",
      amount: tx.amount,
      newBalance,
    });
  }

  // Failed (deny/expire/cancel)
  await db.walletTransaction.update({
    where: { id: tx.id },
    data: { status: WalletTxStatus.FAILED },
  });

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "wallet",
    action: "wallet.topup.failed",
    targetId: tx.id,
    targetType: "wallet_transaction",
    description: `Top-up ${tx.code} gagal (${transactionStatus}).`,
    outcome: "failure",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({
    txCode: tx.code,
    status: "FAILED",
    message: "Top-up gagal. Saldo tidak berubah.",
  });
}
