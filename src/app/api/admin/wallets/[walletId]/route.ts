/**
 * PATCH /api/admin/wallets/[walletId]
 *
 * Admin: freeze / unfreeze wallet, atau adjust saldo (manual correction).
 *
 * Body: {
 *   action: "freeze" | "unfreeze" | "adjust",
 *   amount?: number,        // untuk adjust: positif=kredit, negatif=debit
 *   reason?: string         // wajib untuk adjust
 * }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { creditWallet, debitWallet } from "@/lib/wallet/wallet-service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ walletId: string }> },
) {
  const me = await requireRole("ADMIN");
  if (!me) {
    return NextResponse.json({ error: "Forbidden. Admin only." }, { status: 403 });
  }

  const meta = getRequestMeta(req);
  const { walletId } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.action) {
    return NextResponse.json({ error: "action wajib diisi" }, { status: 400 });
  }

  const wallet = await db.wallet.findUnique({
    where: { id: walletId },
    include: { user: { select: { id: true, email: true, fullName: true, role: true } } },
  });
  if (!wallet) {
    return NextResponse.json({ error: "Wallet tidak ditemukan" }, { status: 404 });
  }

  const action = body.action as "freeze" | "unfreeze" | "adjust";

  if (action === "freeze") {
    if (wallet.isFrozen) {
      return NextResponse.json({ error: "Wallet sudah dibekukan" }, { status: 400 });
    }
    const updated = await db.wallet.update({
      where: { id: walletId },
      data: { isFrozen: true },
    });
    await logAction({
      actorId: me.id,
      actorEmail: me.email,
      actorRole: me.role,
      category: "wallet",
      action: "wallet.admin.freeze",
      description: `Wallet ${wallet.user.email} dibekukan oleh admin.`,
      targetId: wallet.id,
      targetType: "wallet",
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { walletOwner: wallet.user.email },
    });
    return NextResponse.json({ wallet: updated, message: "Wallet dibekukan" });
  }

  if (action === "unfreeze") {
    if (!wallet.isFrozen) {
      return NextResponse.json({ error: "Wallet tidak dibekukan" }, { status: 400 });
    }
    const updated = await db.wallet.update({
      where: { id: walletId },
      data: { isFrozen: false },
    });
    await logAction({
      actorId: me.id,
      actorEmail: me.email,
      actorRole: me.role,
      category: "wallet",
      action: "wallet.admin.unfreeze",
      description: `Wallet ${wallet.user.email} di-unfreeze oleh admin.`,
      targetId: wallet.id,
      targetType: "wallet",
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { walletOwner: wallet.user.email },
    });
    return NextResponse.json({ wallet: updated, message: "Wallet di-unfreeze" });
  }

  if (action === "adjust") {
    const amount = Number(body.amount);
    const reason = body.reason ? String(body.reason).trim().slice(0, 300) : "";
    if (!reason) {
      return NextResponse.json({ error: "reason wajib untuk adjust" }, { status: 400 });
    }
    if (!Number.isInteger(amount) || amount === 0) {
      return NextResponse.json(
        { error: "amount harus integer non-zero (positif=kredit, negatif=debit)" },
        { status: 400 },
      );
    }
    if (Math.abs(amount) > 10_000_000) {
      return NextResponse.json(
        { error: "Adjustment maksimal Rp 10.000.000 per transaksi" },
        { status: 400 },
      );
    }

    let tx;
    if (amount > 0) {
      tx = await creditWallet({
        userId: wallet.userId,
        amount,
        type: "ADJUSTMENT",
        description: `Adjustment oleh admin: ${reason}`,
        metadata: { adminEmail: me.email, reason, type: "credit" },
      });
    } else {
      try {
        tx = await debitWallet({
          userId: wallet.userId,
          amount: Math.abs(amount),
          type: "ADJUSTMENT",
          description: `Adjustment oleh admin: ${reason}`,
          metadata: { adminEmail: me.email, reason, type: "debit" },
        });
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Gagal debit wallet" },
          { status: 400 },
        );
      }
    }

    await logAction({
      actorId: me.id,
      actorEmail: me.email,
      actorRole: me.role,
      category: "wallet",
      action: "wallet.admin.adjust",
      description: `Saldo wallet ${wallet.user.email} di-adjust ${amount > 0 ? "+" : ""}Rp ${amount.toLocaleString("id-ID")} oleh admin. Alasan: ${reason}`,
      targetId: wallet.id,
      targetType: "wallet",
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { walletOwner: wallet.user.email, amount, reason, txCode: tx.code },
    });

    return NextResponse.json({
      txCode: tx.code,
      amount,
      message: "Adjustment berhasil",
    });
  }

  return NextResponse.json({ error: "action tidak valid" }, { status: 400 });
}
