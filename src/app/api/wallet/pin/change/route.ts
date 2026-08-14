/**
 * POST /api/wallet/pin/change
 *
 * Ganti PIN yang sudah ada. Butuh verify PIN lama dulu.
 *
 * Body: { currentPin: string, newPin: string, confirmNewPin: string }
 *
 * Logic:
 *  - Verify currentPin (dengan attempt tracking)
 *  - Validate newPin format
 *  - Validate newPin === confirmNewPin
 *  - Validate newPin !== currentPin
 *  - Hash new PIN, update DB
 *  - Audit log
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { rateLimitResponse } from "@/lib/auth/api-rate-limiter";
import {
  setWalletPin,
  hasWalletPin,
  verifyWalletPin,
  isPinLocked,
  isValidPinFormat,
  PIN_LENGTH,
} from "@/lib/wallet/pin-service";

const WEAK_PINS = new Set([
  "000000", "111111", "222222", "333333", "444444", "555555",
  "666666", "777777", "888888", "999999", "123456", "654321",
  "112233", "221133", "123123", "111222", "000999",
]);

export async function POST(req: Request) {
  // 🔒 Rate limit: 5 change PIN per menit per IP
  const limited = rateLimitResponse(req, "wallet:pin:change", 5, 60_000);
  if (limited) return limited;

  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body?.currentPin || !body?.newPin || !body?.confirmNewPin) {
    return NextResponse.json(
      { error: "PIN lama, PIN baru, dan konfirmasi wajib diisi." },
      { status: 400 },
    );
  }

  const currentPin = String(body.currentPin);
  const newPin = String(body.newPin);
  const confirmNewPin = String(body.confirmNewPin);

  // === Cek apakah user sudah punya PIN ===
  const hasPin = await hasWalletPin(me.id);
  if (!hasPin) {
    return NextResponse.json(
      {
        error: "Anda belum punya PIN. Gunakan endpoint /api/wallet/pin/set untuk membuat PIN.",
        code: "PIN_NOT_SET",
      },
      { status: 409 },
    );
  }

  // === Cek lockout ===
  const lockStatus = isPinLocked(me.id);
  if (lockStatus.locked) {
    return NextResponse.json({
      error: `PIN terkunci. Coba lagi dalam ${lockStatus.retryAfterSeconds} detik.`,
      code: "PIN_LOCKED",
      retryAfterSeconds: lockStatus.retryAfterSeconds,
    }, { status: 429 });
  }

  // === Verify PIN lama ===
  const verifyResult = await verifyWalletPin(me.id, currentPin);
  if (!verifyResult.valid) {
    if (verifyResult.retryAfterSeconds) {
      return NextResponse.json({
        error: `Terlalu banyak percobaan salah. PIN terkunci ${verifyResult.retryAfterSeconds} detik.`,
        code: "PIN_LOCKED",
        retryAfterSeconds: verifyResult.retryAfterSeconds,
      }, { status: 429 });
    }
    return NextResponse.json({
      error: `PIN lama salah. Sisa percobaan: ${verifyResult.remaining}/${verifyResult.maxAttempts}.`,
      code: "PIN_INVALID",
      remaining: verifyResult.remaining,
      maxAttempts: verifyResult.maxAttempts,
    }, { status: 401 });
  }

  // === Validasi PIN baru ===
  if (!isValidPinFormat(newPin)) {
    return NextResponse.json(
      { error: `PIN baru harus ${PIN_LENGTH} digit angka.` },
      { status: 400 },
    );
  }
  if (newPin !== confirmNewPin) {
    return NextResponse.json(
      { error: "PIN baru dan konfirmasi tidak cocok." },
      { status: 400 },
    );
  }
  if (newPin === currentPin) {
    return NextResponse.json(
      { error: "PIN baru tidak boleh sama dengan PIN lama." },
      { status: 400 },
    );
  }
  if (WEAK_PINS.has(newPin)) {
    return NextResponse.json(
      { error: "PIN baru terlalu mudah ditebak. Pilih kombinasi yang lebih acak." },
      { status: 400 },
    );
  }

  // === Set PIN baru ===
  try {
    await setWalletPin(me.id, newPin);

    await logAction({
      actorId: me.id,
      actorEmail: me.email,
      actorRole: me.role,
      category: "wallet",
      action: "wallet.pin.changed",
      description: `PIN RejoPay berhasil diubah.`,
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, message: "PIN berhasil diubah." });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengubah PIN." },
      { status: 500 },
    );
  }
}
