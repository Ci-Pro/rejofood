/**
 * POST /api/auth/2fa/enable
 * Body: { challengeToken, code }
 *
 * Finalisasi setup 2FA:
 *  1. Ambil challenge (type="setup") + pendingSecret
 *  2. Verifikasi code TOTP terhadap pendingSecret
 *  3. Jika valid → simpan twoFactorSecret + twoFactorEnabled=true ke DB
 *  4. Buat session, set cookie, return user
 *
 * Jika invalid → record attempt, hapus challenge setelah 5 percobaan.
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
    if (!challenge || challenge.type !== "setup" || !challenge.pendingSecret) {
      await logAction({
        actorEmail: challenge?.email,
        category: "auth",
        action: "auth.2fa.setup_failed",
        description: "Setup 2FA gagal: challenge tidak valid atau kedaluwarsa.",
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
        action: "auth.2fa.setup_exhausted",
        description: "Setup 2FA gagal 5x untuk " + challenge.email + ". Challenge di-destroy.",
        outcome: "denied",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Silakan login ulang.", code: "CHALLENGE_EXHAUSTED" },
        { status: 429 },
      );
    }

    const valid = verifyToken(body.code, challenge.pendingSecret);
    if (!valid) {
      await logAction({
        actorId: challenge.userId,
        actorEmail: challenge.email,
        category: "auth",
        action: "auth.2fa.setup_failed",
        description: `Verifikasi TOTP gagal saat setup untuk ${challenge.email}. Sisa: ${attempt.remaining - 1}.`,
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

    // ✅ Valid — persist secret + enable 2FA
    await db.user.update({
      where: { id: challenge.userId },
      data: {
        twoFactorSecret: challenge.pendingSecret,
        twoFactorEnabled: true,
      },
    });

    consumeChallenge(body.challengeToken);

    // Buat session
    const user = await db.user.findUnique({ where: { id: challenge.userId } });
    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

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
      action: "auth.2fa.setup_success",
      description: `2FA berhasil diaktifkan untuk admin ${user.email}. Login selesai.`,
      targetId: user.id,
      targetType: "user",
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
    console.error("[2fa/enable] error", err);
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
