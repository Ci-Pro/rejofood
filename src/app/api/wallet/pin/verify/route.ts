/**
 * POST /api/wallet/pin/verify
 *
 * Verify PIN untuk konfirmasi transaksi (pay/withdraw).
 *
 * Body: { pin: string }
 *
 * Return:
 *  - 200 { valid: true } jika PIN benar
 *  - 200 { valid: false, remaining, maxAttempts } jika salah (masih ada kesempatan)
 *  - 200 { valid: false, retryAfterSeconds } jika terkunci (3× salah)
 *
 * Catatan: PIN verification tidak perlu rate limit tambahan —
 * pin-service.ts sudah handle lockout internal (3 attempts → 5 menit lock).
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { verifyWalletPin, isPinLocked } from "@/lib/wallet/pin-service";
import { recordPinFailure, resetFailures } from "@/lib/auth/suspicious-activity";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body?.pin) {
    return NextResponse.json({ error: "PIN wajib diisi." }, { status: 400 });
  }

  // Cek lockout dulu untuk UX lebih baik
  const lockStatus = isPinLocked(me.id);
  if (lockStatus.locked) {
    return NextResponse.json({
      valid: false,
      locked: true,
      retryAfterSeconds: lockStatus.retryAfterSeconds,
      message: `PIN terkunci. Coba lagi dalam ${lockStatus.retryAfterSeconds} detik.`,
    });
  }

  const result = await verifyWalletPin(me.id, String(body.pin));

  if (result.valid) {
    // Reset failure counters saat sukses
    resetFailures(me.id);
    return NextResponse.json({ valid: true });
  }

  // Failed: log + record suspicious activity
  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role,
    category: "wallet",
    action: "wallet.pin.verify_failed",
    description: `Verifikasi PIN gagal. Sisa percobaan: ${result.remaining ?? 0}/${result.maxAttempts}.`,
    outcome: "failure",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      remaining: result.remaining ?? 0,
      locked: !!result.retryAfterSeconds,
    },
  });

  // Record suspicious activity — auto-flag kalau exceed threshold
  const suspicion = await recordPinFailure(me.id, meta.ipAddress);

  if (suspicion.flagged) {
    return NextResponse.json({
      valid: false,
      flagged: true,
      message: "Akun di-flag karena aktivitas mencurigakan. Hubungi support@rejofood.id.",
    }, { status: 403 });
  }

  if (result.retryAfterSeconds) {
    return NextResponse.json({
      valid: false,
      locked: true,
      retryAfterSeconds: result.retryAfterSeconds,
      message: `Terlalu banyak percobaan salah. PIN terkunci ${result.retryAfterSeconds} detik.`,
    });
  }

  return NextResponse.json({
    valid: false,
    remaining: result.remaining,
    maxAttempts: result.maxAttempts,
    message: `PIN salah. Sisa percobaan: ${result.remaining}/${result.maxAttempts}.`,
  });
}
