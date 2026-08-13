/**
 * GET /api/wallet
 *
 * Get wallet balance + summary untuk user yang sedang login.
 * Auto-create wallet jika belum ada (lazy init).
 *
 * Response:
 *   {
 *     wallet: { id, balance, isFrozen, hasPin, createdAt },
 *     summary: { monthTopup, monthSpending, monthEarning, txCount },
 *     recent: WalletTransaction[] (5 transaksi terakhir)
 *   }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";
import { getWalletSummary } from "@/lib/wallet/wallet-service";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { wallet, monthTopup, monthSpending, monthEarning, txCount } =
      await getWalletSummary(me.id);

    const recent = await db.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        code: true,
        type: true,
        status: true,
        amount: true,
        balanceAfter: true,
        description: true,
        orderId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      wallet: {
        id: wallet.id,
        balance: wallet.balance,
        isFrozen: wallet.isFrozen,
        hasPin: !!wallet.pinHash,
        createdAt: wallet.createdAt,
      },
      summary: {
        monthTopup,
        monthSpending,
        monthEarning,
        txCount,
      },
      recent,
    });
  } catch (err) {
    console.error("[wallet] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memuat wallet" },
      { status: 500 },
    );
  }
}
