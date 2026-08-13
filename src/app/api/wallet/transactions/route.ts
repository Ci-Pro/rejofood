/**
 * GET /api/wallet/transactions
 *
 * Riwayat transaksi dompet dengan pagination + filter.
 *
 * Query params:
 *   ?page=1&limit=20&type=TOPUP|PAYMENT|REFUND|EARNING|WITHDRAWAL|ADJUSTMENT
 *
 * Response: {
 *   items: WalletTransaction[],
 *   total, page, limit, totalPages
 * }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";
import { WalletTxType } from "@prisma/client";

const VALID_TYPES: WalletTxType[] = [
  "TOPUP", "PAYMENT", "REFUND", "EARNING", "WITHDRAWAL", "ADJUSTMENT",
];

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
  const typeParam = url.searchParams.get("type");

  const where: { wallet?: { userId: string }; type?: WalletTxType } = {};
  // Pakai relasi wallet.userId untuk filter (lebih aman daripada userId langsung,
  // karena userId di WalletTransaction bisa refer ke user lain untuk EARNING cross-user)
  const wallet = await db.wallet.findUnique({
    where: { userId: me.id },
    select: { id: true },
  });
  if (!wallet) {
    return NextResponse.json({ items: [], total: 0, page, limit, totalPages: 0 });
  }
  where.wallet = { userId: me.id };
  if (typeParam && VALID_TYPES.includes(typeParam as WalletTxType)) {
    where.type = typeParam as WalletTxType;
  }

  const [items, total] = await Promise.all([
    db.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        code: true,
        type: true,
        status: true,
        amount: true,
        balanceAfter: true,
        description: true,
        orderId: true,
        gatewayReference: true,
        createdAt: true,
      },
    }),
    db.walletTransaction.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
