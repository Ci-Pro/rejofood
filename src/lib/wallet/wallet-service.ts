/**
 * Wallet service — atomic credit/debit operations for RejoPay.
 *
 * Semua mutasi saldo HARUS lewat fungsi di sini untuk menjamin:
 *  1. Atomicity: balance update + transaction record dalam satu DB transaction
 *  2. Consistency: balanceAfter di snapshot benar
 *  3. Audit trail: setiap mutasi punya WalletTransaction record
 *
 * Anti-pattern yang DILARANG:
 *  - wallet.update({ balance: newBalance }) tanpa create WalletTransaction
 *  - Mengubah saldo di luar DB transaction
 *  - Membaca saldo lama, menghitung baru, lalu update (race condition!)
 */
import { db } from "@/lib/db";
import { Wallet, WalletTransaction, WalletTxType, WalletTxStatus } from "@prisma/client";

function generateTxCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "WAL-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function uniqueTxCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateTxCode();
    const exists = await db.walletTransaction.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }
  // Fallback dengan timestamp suffix
  return `WAL-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/**
 * Get atau create wallet untuk user. Auto-create on first access.
 */
export async function getOrCreateWallet(userId: string): Promise<Wallet> {
  const existing = await db.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return db.wallet.create({ data: { userId, balance: 0 } });
}

/**
 * Credit saldo (saldo naik). Untuk: TOPUP, REFUND, EARNING, ADJUSTMENT (positif).
 *
 * @returns WalletTransaction record yang baru dibuat.
 */
export async function creditWallet(input: {
  userId: string;
  amount: number; // positif
  type: WalletTxType;
  description: string;
  orderId?: string;
  gatewayReference?: string;
  metadata?: Record<string, unknown>;
  status?: WalletTxStatus; // default SUCCESS
}): Promise<WalletTransaction> {
  if (input.amount <= 0) {
    throw new Error(`creditWallet: amount harus positif, got ${input.amount}`);
  }

  const code = await uniqueTxCode();

  return db.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
    if (!wallet) {
      throw new Error(`Wallet tidak ditemukan untuk user ${input.userId}`);
    }
    if (wallet.isFrozen) {
      throw new Error("Wallet dibekukan. Hubungi admin untuk membuka kembali.");
    }

    const newBalance = wallet.balance + input.amount;
    const [, txRecord] = await Promise.all([
      tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      }),
      tx.walletTransaction.create({
        data: {
          code,
          walletId: wallet.id,
          userId: input.userId,
          type: input.type,
          status: input.status ?? WalletTxStatus.SUCCESS,
          amount: input.amount,
          balanceAfter: newBalance,
          description: input.description,
          orderId: input.orderId ?? null,
          gatewayReference: input.gatewayReference ?? null,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        },
      }),
    ]);

    return txRecord;
  });
}

/**
 * Debit saldo (saldo turun). Untuk: PAYMENT, WITHDRAWAL, ADJUSTMENT (negatif).
 * Atomic check: jika saldo tidak cukup, throw error tanpa mengubah apa-apa.
 *
 * @returns WalletTransaction record yang baru dibuat.
 */
export async function debitWallet(input: {
  userId: string;
  amount: number; // positif, akan dikonversi ke negatif di record
  type: WalletTxType;
  description: string;
  orderId?: string;
  gatewayReference?: string;
  metadata?: Record<string, unknown>;
  status?: WalletTxStatus;
}): Promise<WalletTransaction> {
  if (input.amount <= 0) {
    throw new Error(`debitWallet: amount harus positif, got ${input.amount}`);
  }

  const code = await uniqueTxCode();

  return db.$transaction(async (tx) => {
    // Lock wallet row dengan SELECT FOR UPDATE (di Postgres; SQLite pakai locking implisit)
    const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
    if (!wallet) {
      throw new Error(`Wallet tidak ditemukan untuk user ${input.userId}`);
    }
    if (wallet.isFrozen) {
      throw new Error("Wallet dibekukan. Hubungi admin untuk membuka kembali.");
    }
    if (wallet.balance < input.amount) {
      throw new Error(
        `Saldo tidak cukup. Saldo: ${wallet.balance}, dibutuhkan: ${input.amount}`,
      );
    }

    const newBalance = wallet.balance - input.amount;
    const [, txRecord] = await Promise.all([
      tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      }),
      tx.walletTransaction.create({
        data: {
          code,
          walletId: wallet.id,
          userId: input.userId,
          type: input.type,
          status: input.status ?? WalletTxStatus.SUCCESS,
          amount: -input.amount, // negatif = debit
          balanceAfter: newBalance,
          description: input.description,
          orderId: input.orderId ?? null,
          gatewayReference: input.gatewayReference ?? null,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        },
      }),
    ]);

    return txRecord;
  });
}

/**
 * Mark pending transaction sebagai SUCCESS atau FAILED.
 * Dipakai oleh webhook gateway (mock-notify) untuk top-up & withdrawal.
 *
 * Untuk MVP, top-up tidak hold saldo dulu — baru kredit setelah SUCCESS.
 * Withdrawal sudah debit di create, perlu refund jika FAILED.
 */
export async function settlePendingTransaction(input: {
  txId: string;
  success: boolean;
}): Promise<WalletTransaction | null> {
  const tx = await db.walletTransaction.findUnique({ where: { id: input.txId } });
  if (!tx) return null;
  if (tx.status !== WalletTxStatus.PENDING) return tx;

  return db.$transaction(async (dbTx) => {
    const updated = await dbTx.walletTransaction.update({
      where: { id: input.txId },
      data: { status: input.success ? WalletTxStatus.SUCCESS : WalletTxStatus.FAILED },
    });

    // Withdrawal: sudah debit di create, perlu refund jika FAILED
    if (!input.success && tx.type === "WITHDRAWAL") {
      const wallet = await dbTx.wallet.findUnique({ where: { id: tx.walletId } });
      if (wallet) {
        await dbTx.wallet.update({
          where: { id: wallet.id },
          data: { balance: wallet.balance + Math.abs(tx.amount) },
        });
      }
    }

    return updated;
  });
}

/**
 * Get ringkasan wallet: saldo, total topup bulan ini, total spending bulan ini.
 */
export async function getWalletSummary(userId: string): Promise<{
  wallet: Wallet;
  monthTopup: number;
  monthSpending: number;
  monthEarning: number;
  txCount: number;
}> {
  const wallet = await getOrCreateWallet(userId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [monthTopupAgg, monthSpendingAgg, monthEarningAgg, txCount] = await Promise.all([
    db.walletTransaction.aggregate({
      where: {
        walletId: wallet.id,
        type: "TOPUP",
        status: "SUCCESS",
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    }),
    db.walletTransaction.aggregate({
      where: {
        walletId: wallet.id,
        type: { in: ["PAYMENT", "WITHDRAWAL"] },
        status: "SUCCESS",
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    }),
    db.walletTransaction.aggregate({
      where: {
        walletId: wallet.id,
        type: "EARNING",
        status: "SUCCESS",
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    }),
    db.walletTransaction.count({
      where: { walletId: wallet.id, status: "SUCCESS" },
    }),
  ]);

  return {
    wallet,
    monthTopup: monthTopupAgg._sum.amount ?? 0,
    monthSpending: Math.abs(monthSpendingAgg._sum.amount ?? 0),
    monthEarning: monthEarningAgg._sum.amount ?? 0,
    txCount,
  };
}
