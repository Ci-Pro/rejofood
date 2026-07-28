/**
 * POST /api/auth/2fa/verify
 * Body: { challengeToken, code }
 *
 * Verifikasi TOTP untuk admin yang SUDAH punya 2FA enabled (login normal).
 * Jika valid → buat session, set cookie, return user.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateToken as generateSessionToken, setSessionCookie } from "@/lib/auth/session";
import { getChallenge, recordChallengeAttempt, consumeChallenge } from "@/lib/auth/challenge-store";
import { verifyToken } from "@/lib/auth/totp";
import { getClientIp } from "@/lib/auth/rate-limiter";
import type { SafeUser } from "@/types/auth";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.challengeToken || typeof body.code !== "string") {
      return NextResponse.json({ error: "challengeToken dan code wajib diisi." }, { status: 400 });
    }

    const challenge = getChallenge(body.challengeToken);
    if (!challenge || challenge.type !== "verify") {
      return NextResponse.json(
        { error: "Challenge tidak valid atau kedaluwarsa. Silakan login ulang." },
        { status: 401 },
      );
    }

    // Rate limit per-challenge (max 5 percobaan)
    const attempt = recordChallengeAttempt(body.challengeToken);
    if (!attempt.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Silakan login ulang.", code: "CHALLENGE_EXHAUSTED" },
        { status: 429 },
      );
    }

    const user = await db.user.findUnique({ where: { id: challenge.userId } });
    if (!user || !user.isActive || !user.twoFactorSecret || !user.twoFactorEnabled) {
      return NextResponse.json({ error: "Akun tidak valid." }, { status: 401 });
    }

    const valid = verifyToken(body.code, user.twoFactorSecret);
    if (!valid) {
      return NextResponse.json(
        {
          error: "Kode TOTP salah. Periksa jam di perangkat Anda.",
          code: "INVALID_TOTP",
          remainingAttempts: attempt.remaining,
        },
        { status: 401 },
      );
    }

    consumeChallenge(body.challengeToken);

    const token = generateSessionToken();
    await db.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        userAgent: req.headers.get("user-agent") ?? null,
        ipAddress: getClientIp(req),
      },
    });
    await setSessionCookie(token);

    const safe: SafeUser = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
    };

    return NextResponse.json({ user: safe });
  } catch (err) {
    console.error("[2fa/verify] error", err);
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
