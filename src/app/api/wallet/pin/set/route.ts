/**
 * POST /api/wallet/pin/set
 *
 * Set PIN pertama kali (atau set ulang setelah clear).
 * User yang sudah punya PIN harus pakai /api/wallet/pin/change.
 *
 * Body: { pin: string, confirmPin: string }
 *
 * Logic:
 *  - Validate PIN format (6 digit)
 *  - Validate pin === confirmPin
 *  - Hash PIN dengan bcrypt, simpan ke wallet.pinHash
 *  - Audit log
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { rateLimitResponse } from "@/lib/auth/api-rate-limiter";
import { setWalletPin, hasWalletPin, isValidPinFormat, PIN_LENGTH } from "@/lib/wallet/pin-service";

export async function POST(req: Request) {
  // 🔒 Rate limit: 5 set PIN per menit per IP
  const limited = rateLimitResponse(req, "wallet:pin:set", 5, 60_000);
  if (limited) return limited;

  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body?.pin || !body?.confirmPin) {
    return NextResponse.json(
      { error: "PIN dan konfirmasi PIN wajib diisi." },
      { status: 400 },
    );
  }

  const pin = String(body.pin);
  const confirmPin = String(body.confirmPin);

  // === Validasi format ===
  if (!isValidPinFormat(pin)) {
    return NextResponse.json(
      { error: `PIN harus ${PIN_LENGTH} digit angka.` },
      { status: 400 },
    );
  }
  if (pin !== confirmPin) {
    return NextResponse.json(
      { error: "PIN dan konfirmasi PIN tidak cocok." },
      { status: 400 },
    );
  }

  // === Cek apakah user sudah punya PIN ===
  const alreadyHasPin = await hasWalletPin(me.id);
  if (alreadyHasPin) {
    return NextResponse.json(
      {
        error: "Anda sudah punya PIN. Gunakan endpoint /api/wallet/pin/change untuk mengganti.",
        code: "PIN_ALREADY_SET",
      },
      { status: 409 },
    );
  }

  // === Validasi PIN lemah (anti 123456, 000000, 111111, dll) ===
  const weakPins = new Set([
    "000000", "111111", "222222", "333333", "444444", "555555",
    "666666", "777777", "888888", "999999", "123456", "654321",
    "112233", "221133", "123123", "111222", "000999",
  ]);
  if (weakPins.has(pin)) {
    return NextResponse.json(
      { error: "PIN terlalu mudah ditebak. Pilih kombinasi yang lebih acak." },
      { status: 400 },
    );
  }

  try {
    await setWalletPin(me.id, pin);

    await logAction({
      actorId: me.id,
      actorEmail: me.email,
      actorRole: me.role,
      category: "wallet",
      action: "wallet.pin.set",
      description: `PIN RejoPay di-set untuk pertama kalinya.`,
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, message: "PIN berhasil di-set." });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal set PIN." },
      { status: 500 },
    );
  }
}
