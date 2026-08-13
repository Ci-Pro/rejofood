/**
 * POST /api/wallet/topup
 *
 * Top-up saldo RejoPay via mock gateway (swap-ready untuk Midtrans/Xendit).
 *
 * Body: {
 *   amount: number (min 10000, max 5000000),
 *   method: "QRIS" | "VA_BCA" | "VA_MANDIRI" | "VA_BNI" | "EWALLET_GOPAY" | "EWALLET_OVO" | "EWALLET_DANA"
 * }
 *
 * Flow:
 *  1. Validate amount + method
 *  2. Verify wallet tidak dibekukan
 *  3. Create PENDING WalletTransaction (type=TOPUP)
 *  4. Generate mock payment URL + VA number
 *  5. Return payment info — customer bayar via UI
 *  6. Customer klik "Saya sudah bayar" → POST /api/payment/mock-notify
 *     → wallet service credit balance + mark SUCCESS
 *
 * Response: {
 *   txId, txCode, amount, method, paymentUrl, vaNumber, expiresAt
 * }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { getOrCreateWallet } from "@/lib/wallet/wallet-service";
import { WalletTxStatus } from "@prisma/client";

const ALLOWED_METHODS = [
  "QRIS", "VA_BCA", "VA_MANDIRI", "VA_BNI",
  "EWALLET_GOPAY", "EWALLET_OVO", "EWALLET_DANA",
] as const;
type TopupMethod = (typeof ALLOWED_METHODS)[number];

const MIN_TOPUP = 10_000;
const MAX_TOPUP = 5_000_000;
const EXPIRY_MINUTES = 15;

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
  return `WAL-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function generateVaNumber(method: string, code: string): string {
  const bankPrefix: Record<string, string> = {
    VA_BCA: "8077",
    VA_MANDIRI: "8822",
    VA_BNI: "9881",
  };
  const base = bankPrefix[method] ?? "0000";
  const rand = Math.floor(Math.random() * 99999999).toString().padStart(8, "0");
  return base + rand + code.replace(/[^0-9]/g, "").slice(0, 4).padStart(4, "0");
}

function methodLabel(method: string): string {
  const map: Record<string, string> = {
    QRIS: "QRIS",
    VA_BCA: "VA BCA",
    VA_MANDIRI: "VA Mandiri",
    VA_BNI: "VA BNI",
    EWALLET_GOPAY: "GoPay",
    EWALLET_OVO: "OVO",
    EWALLET_DANA: "DANA",
  };
  return map[method] ?? method;
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body?.amount || !body?.method) {
    return NextResponse.json(
      { error: "amount dan method wajib diisi" },
      { status: 400 },
    );
  }

  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) {
    return NextResponse.json(
      { error: `Amount harus integer antara Rp ${MIN_TOPUP.toLocaleString("id-ID")} dan Rp ${MAX_TOPUP.toLocaleString("id-ID")}` },
      { status: 400 },
    );
  }

  const method = body.method as TopupMethod;
  if (!ALLOWED_METHODS.includes(method)) {
    return NextResponse.json({ error: "Method tidak valid" }, { status: 400 });
  }

  try {
    const wallet = await getOrCreateWallet(me.id);
    if (wallet.isFrozen) {
      return NextResponse.json(
        { error: "Wallet dibekukan. Hubungi admin untuk membuka kembali." },
        { status: 403 },
      );
    }

    const code = await uniqueTxCode();
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);
    const gatewayRef = `MOCK-TU-${code}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const paymentUrl = `https://mock-gateway.rejofood.id/topup/${code}`;
    const vaNumber = method.startsWith("VA_") ? generateVaNumber(method, code) : null;

    // Create PENDING transaction — saldo belum di-credit.
    // Setelah customer konfirmasi pembayaran (mock-notify), credit saldo + mark SUCCESS.
    const tx = await db.walletTransaction.create({
      data: {
        code,
        walletId: wallet.id,
        userId: me.id,
        type: "TOPUP",
        status: WalletTxStatus.PENDING,
        amount: amount, // positif
        balanceAfter: wallet.balance, // belum berubah
        description: `Top-up via ${methodLabel(method)}`,
        gatewayReference: gatewayRef,
        metadata: JSON.stringify({
          method,
          paymentUrl,
          vaNumber,
          expiresAt: expiresAt.toISOString(),
        }),
      },
    });

    await logAction({
      actorId: me.id,
      actorEmail: me.email,
      actorRole: me.role,
      category: "wallet",
      action: "wallet.topup.create",
      targetId: tx.id,
      targetType: "wallet_transaction",
      description: `Top-up ${methodLabel(method)} senilai Rp ${amount.toLocaleString("id-ID")} dibuat (PENDING)`,
      metadata: { txCode: code, amount, method },
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({
      txId: tx.id,
      txCode: code,
      amount,
      method,
      methodLabel: methodLabel(method),
      paymentUrl,
      vaNumber,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[wallet/topup] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat top-up" },
      { status: 500 },
    );
  }
}
