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
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { computeAbsoluteExpiry } from "@/lib/auth/session-config";
import type { SafeUser } from "@/types/auth";

export async function POST(req: Request) {
  const meta = getRequestMeta(req);
  try {
    const body = await req.json().catch(() => null);
    if (!body?.challengeToken || typeof body.code !== "string") {
      return NextResponse.json({ error: "challengeToken dan code wajib diisi." }, { status: 400 });
    }

    const challenge = getChallenge(body.challengeToken);
    if (!challenge || challenge.type !== "verify") {
      await logAction({
        actorEmail: challenge?.email,
        category: "auth",
        action: "auth.2fa.verify_failed",
        description: "Verifikasi 2FA gagal: challenge tidak valid atau kedaluwarsa.",
        outcome: "failure",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return NextResponse.json(
        { error: "Challenge tidak valid atau kedaluwarsa. Silakan login ulang." },
        { status: 401 },
      );
    }

    // Rate limit per-challenge (max 5 percobaan)
    const attempt = recordChallengeAttempt(body.challengeToken);
    if (!attempt.ok) {
      await logAction({
        actorId: challenge.userId,
        actorEmail: challenge.email,
        category: "auth",
        action: "auth.2fa.verify_exhausted",
        description: "Verifikasi 2FA gagal 5x untuk " + challenge.email + ". Challenge di-destroy.",
        outcome: "denied",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
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
      await logAction({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        category: "auth",
        action: "auth.2fa.verify_failed",
        description: "Verifikasi TOTP gagal untuk " + user.email + ". Sisa: " + (attempt.remaining - 1) + ".",
        outcome: "failure",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { remainingAttempts: attempt.remaining - 1 },
      });
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
        expiresAt: computeAbsoluteExpiry(user.role),
        lastActivityAt: new Date(),
        userAgent: req.headers.get("user-agent") ?? null,
        ipAddress: getClientIp(req),
      },
    });
    await setSessionCookie(token);

    await logAction({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      category: "auth",
      action: "auth.2fa.verify_success",
      description: "Verifikasi 2FA berhasil untuk admin " + user.email + ". Login selesai.",
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

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
