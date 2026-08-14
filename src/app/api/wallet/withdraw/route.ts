/**
 * POST /api/wallet/withdraw
 *
 * Withdraw saldo ke bank account (untuk driver & merchant).
 * Customer tidak bisa withdraw (hanya bisa pakai untuk bayar order).
 *
 * Body: {
 *   amount: number (min 50000),
 *   bankCode: "BCA" | "BNI" | "MANDIRI" | "BRI" | "PERMATA",
 *   accountNumber: string,
 *   accountName: string
 * }
 *
 * Flow MVP:
 *  1. Validate amount + bank info
 *  2. Debit saldo secara atomic (langsung SUCCESS untuk MVP)
 *  3. Record transaction type=WITHDRAWAL
 *  4. Di production: integrate ke disbursement API (Xendit Disbursement / Midtrans Payout)
 *
 * Response: { txId, txCode, amount, status, estimatedCompletion }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { rateLimitResponse } from "@/lib/auth/api-rate-limiter";
import { getOrCreateWallet, debitWallet } from "@/lib/wallet/wallet-service";
import { verifyWalletPin, requiresPin, isPinLocked } from "@/lib/wallet/pin-service";

const ALLOWED_BANKS = ["BCA", "BNI", "MANDIRI", "BRI", "PERMATA"] as const;
type BankCode = (typeof ALLOWED_BANKS)[number];

const MIN_WITHDRAW = 50_000;

function generateTxCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "WAL-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function POST(req: Request) {
  // 🔒 Rate limit: 3 withdraw per menit per IP (anti fraud, dana sensitif)
  const limited = rateLimitResponse(req, "wallet:withdraw", 3, 60_000);
  if (limited) return limited;

  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Hanya DRIVER & MERCHANT yang bisa withdraw
  if (me.role !== "DRIVER" && me.role !== "MERCHANT") {
    return NextResponse.json(
      { error: "Hanya driver & merchant yang bisa withdraw saldo." },
      { status: 403 },
    );
  }

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body?.amount || !body?.bankCode || !body?.accountNumber || !body?.accountName) {
    return NextResponse.json(
      { error: "amount, bankCode, accountNumber, accountName wajib diisi" },
      { status: 400 },
    );
  }

  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount < MIN_WITHDRAW) {
    return NextResponse.json(
      { error: `Minimal withdraw Rp ${MIN_WITHDRAW.toLocaleString("id-ID")}` },
      { status: 400 },
    );
  }

  const bankCode = body.bankCode as BankCode;
  if (!ALLOWED_BANKS.includes(bankCode)) {
    return NextResponse.json({ error: "Bank tidak didukung" }, { status: 400 });
  }

  const accountNumber = String(body.accountNumber).replace(/\D/g, "");
  const accountName = String(body.accountName).trim().slice(0, 100);
  if (accountNumber.length < 6 || accountNumber.length > 20) {
    return NextResponse.json({ error: "Nomor rekening tidak valid" }, { status: 400 });
  }

  try {
    // Verify wallet exists & not frozen
    const wallet = await getOrCreateWallet(me.id);
    if (wallet.isFrozen) {
      return NextResponse.json(
        { error: "Wallet dibekukan. Hubungi admin." },
        { status: 403 },
      );
    }
    if (wallet.balance < amount) {
      return NextResponse.json(
        { error: `Saldo tidak cukup. Saldo: Rp ${wallet.balance.toLocaleString("id-ID")}` },
        { status: 400 },
      );
    }

    // 🔒 PIN verification untuk withdrawal (selalu butuh jika PIN sudah diset)
    const needPin = await requiresPin(me.id, amount, "WITHDRAWAL");
    if (needPin) {
      const lockStatus = isPinLocked(me.id);
      if (lockStatus.locked) {
        return NextResponse.json({
          error: `PIN terkunci. Coba lagi dalam ${lockStatus.retryAfterSeconds} detik.`,
          code: "PIN_LOCKED",
          retryAfterSeconds: lockStatus.retryAfterSeconds,
        }, { status: 429 });
      }
      const pin = body.pin ? String(body.pin) : "";
      const pinResult = await verifyWalletPin(me.id, pin);
      if (!pinResult.valid) {
        if (pinResult.retryAfterSeconds) {
          return NextResponse.json({
            error: `Terlalu banyak percobaan PIN salah. Terkunci ${pinResult.retryAfterSeconds} detik.`,
            code: "PIN_LOCKED",
            retryAfterSeconds: pinResult.retryAfterSeconds,
          }, { status: 429 });
        }
        return NextResponse.json({
          error: `PIN salah. Sisa percobaan: ${pinResult.remaining}/${pinResult.maxAttempts}.`,
          code: "PIN_INVALID",
          remaining: pinResult.remaining,
          maxAttempts: pinResult.maxAttempts,
        }, { status: 401 });
      }
    }

    // Debit atomically + create transaction record
    const tx = await debitWallet({
      userId: me.id,
      amount,
      type: "WITHDRAWAL",
      description: `Withdraw ke ${bankCode} ••${accountNumber.slice(-4)}`,
      gatewayReference: `MOCK-WD-${Date.now().toString(36).toUpperCase()}`,
      metadata: {
        bankCode,
        accountNumber: accountNumber.slice(0, -4).replace(/./g, "•") + accountNumber.slice(-4),
        accountName,
      },
    });

    await logAction({
      actorId: me.id,
      actorEmail: me.email,
      actorRole: me.role,
      category: "wallet",
      action: "wallet.withdraw",
      targetId: tx.id,
      targetType: "wallet_transaction",
      description: `Withdraw Rp ${amount.toLocaleString("id-ID")} ke ${bankCode} ${accountNumber.slice(-4)}`,
      metadata: { txCode: tx.code, amount, bankCode },
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({
      txId: tx.id,
      txCode: tx.code,
      amount,
      status: tx.status,
      estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      message: "Withdraw dikirim. Dana akan masuk dalam 1×24 jam.",
    });
  } catch (err) {
    console.error("[wallet/withdraw] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal withdraw" },
      { status: 500 },
    );
  }
}
