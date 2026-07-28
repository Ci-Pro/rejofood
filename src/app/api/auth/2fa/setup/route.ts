/**
 * POST /api/auth/2fa/setup
 * Body: { challengeToken }
 *
 * Mengembalikan data yang diperlukan untuk menampilkan QR code:
 *  - secret (base32, untuk input manual)
 *  - otpauthUrl (untuk render QR)
 *  - qrDataUrl (data:image/png;base64,...) — siap dipakai di <img src=...>
 *
 * Hanya valid untuk challenge dengan type="setup".
 */
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getChallenge } from "@/lib/auth/challenge-store";
import { buildOtpAuthUrl } from "@/lib/auth/totp";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.challengeToken) {
      return NextResponse.json({ error: "challengeToken wajib diisi." }, { status: 400 });
    }

    const challenge = getChallenge(body.challengeToken);
    if (!challenge || challenge.type !== "setup" || !challenge.pendingSecret) {
      return NextResponse.json(
        { error: "Challenge tidak valid atau kedaluwarsa. Silakan login ulang." },
        { status: 401 },
      );
    }

    const otpauthUrl = buildOtpAuthUrl(challenge.email, challenge.pendingSecret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 240,
      margin: 1,
      color: { dark: "#2D1B4E", light: "#FFFFFF" },
    });

    return NextResponse.json({
      secret: challenge.pendingSecret,
      otpauthUrl,
      qrDataUrl,
      email: challenge.email,
    });
  } catch (err) {
    console.error("[2fa/setup] error", err);
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
