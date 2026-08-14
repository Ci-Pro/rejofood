/**
 * POST /api/auth/login
 * Body: { email, password, expectedRole? }
 *
 * Flow:
 *  1. Verifikasi email + password (factor 1)
 *  2. Jika role === ADMIN → 2FA wajib (setup first-time atau verify)
 *  3. Role lain → langsung set session cookie
 *
 * SECURITY:
 *  - Rate limit: 5 percobaan / 15 menit per (IP, email) → lockout 30 menit
 *  - Saat env `REJO_DEMO_MODE !== 'true'`, email demo admin ditolak meski password benar
 *  - Role mismatch tidak dihitung sebagai failure (UX, bukan serangan)
 *  - Semua event login tercatat di AuditLog: success, failed, locked_out, role_mismatch, demo_blocked
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { generateToken as generateSessionToken, setSessionCookie } from "@/lib/auth/session";
import {
  checkRateLimit,
  recordFailure,
  recordSuccess,
  getClientIp,
} from "@/lib/auth/rate-limiter";
import { createChallenge } from "@/lib/auth/challenge-store";
import { generateSecret } from "@/lib/auth/totp";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { computeAbsoluteExpiry } from "@/lib/auth/session-config";
import { Role } from "@prisma/client";
import type { SafeUser } from "@/types/auth";

const DEMO_BLOCKED_EMAILS = new Set(["admin@rejofood.id"]);

function isDemoMode(): boolean {
  return process.env.REJO_DEMO_MODE === "true";
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} detik`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m} menit ${s} detik` : `${m} menit`;
}

export async function POST(req: Request) {
  const meta = getRequestMeta(req);
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
      return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const ip = getClientIp(req);

    // 🔒 RATE LIMIT — cek sebelum memproses
    const rl = checkRateLimit(ip, email);
    if (!rl.ok) {
      await logAction({
        actorEmail: email,
        category: "auth",
        action: "auth.login.locked_out",
        description: `Login ditolak karena rate limit. Coba lagi dalam ${formatDuration(rl.retryAfterSeconds)}.`,
        outcome: "denied",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { retryAfterSeconds: rl.retryAfterSeconds, lockedUntil: rl.lockedUntil },
      });
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${formatDuration(rl.retryAfterSeconds)}.`,
          code: "LOCKED_OUT",
          retryAfterSeconds: rl.retryAfterSeconds,
          lockedUntil: rl.lockedUntil,
        },
        { status: 429 },
      );
    }

    // 🔒 SECURITY: blokir email demo admin di production.
    if (!isDemoMode() && DEMO_BLOCKED_EMAILS.has(email)) {
      const after = recordFailure(ip, email);
      await logAction({
        actorEmail: email,
        category: "auth",
        action: "auth.login.demo_blocked",
        description: "Login ditolak: akun demo admin dinonaktifkan di production.",
        outcome: "denied",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { remainingAttempts: after.remaining },
      });
      return NextResponse.json(
        {
          error: "Email atau password salah.",
          remainingAttempts: after.remaining,
          maxAttempts: after.maxAttempts,
        },
        { status: 401 },
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      const after = recordFailure(ip, email);
      const isLocked = after.lockedUntil !== null;
      await logAction({
        actorEmail: email,
        category: "auth",
        action: "auth.login.failed",
        description: isLocked
          ? `Login gagal (akun tidak ditemukan/nonaktif) → lockout terpicu.`
          : `Login gagal: akun tidak ditemukan atau nonaktif.`,
        outcome: isLocked ? "denied" : "failure",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          reason: user ? "inactive" : "not_found",
          remainingAttempts: after.remaining,
          ...(isLocked && { lockedUntil: after.lockedUntil }),
        },
      });
      return NextResponse.json(
        {
          error: isLocked
            ? `Terlalu banyak percobaan gagal. Coba lagi dalam ${formatDuration(after.retryAfterSeconds)}.`
            : "Email atau password salah.",
          code: isLocked ? "LOCKED_OUT" : "INVALID_CREDENTIALS",
          remainingAttempts: after.remaining,
          maxAttempts: after.maxAttempts,
          ...(isLocked && { retryAfterSeconds: after.retryAfterSeconds }),
        },
        { status: isLocked ? 429 : 401 },
      );
    }

    if (!verifyPassword(body.password, user.passwordHash)) {
      const after = recordFailure(ip, email);
      const isLocked = after.lockedUntil !== null;
      await logAction({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        category: "auth",
        action: "auth.login.failed",
        description: isLocked
          ? `Login gagal (password salah) → lockout terpicu untuk ${user.email}.`
          : `Login gagal: password salah untuk ${user.email}.`,
        outcome: isLocked ? "denied" : "failure",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          reason: "wrong_password",
          remainingAttempts: after.remaining,
          ...(isLocked && { lockedUntil: after.lockedUntil }),
        },
      });
      return NextResponse.json(
        {
          error: isLocked
            ? `Terlalu banyak percobaan gagal. Coba lagi dalam ${formatDuration(after.retryAfterSeconds)}.`
            : "Email atau password salah.",
          code: isLocked ? "LOCKED_OUT" : "INVALID_CREDENTIALS",
          remainingAttempts: after.remaining,
          maxAttempts: after.maxAttempts,
          ...(isLocked && { retryAfterSeconds: after.retryAfterSeconds }),
        },
        { status: isLocked ? 429 : 401 },
      );
    }

    if (body.expectedRole && user.role !== (body.expectedRole as Role)) {
      await logAction({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        category: "auth",
        action: "auth.login.role_mismatch",
        description: `Login ditolak: akun ${user.email} adalah ${user.role}, bukan ${body.expectedRole}.`,
        outcome: "denied",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { expectedRole: body.expectedRole, actualRole: user.role },
      });
      return NextResponse.json(
        {
          error: `Akun ini bukan role ${body.expectedRole}. Silakan pilih role yang sesuai.`,
          code: "ROLE_MISMATCH",
        },
        { status: 403 },
      );
    }

    // ✅ Password verified — factor 1 complete. Reset rate limit bucket.
    recordSuccess(ip, email);

    // 🔒 2FA: WAJIB untuk ADMIN.
    if (user.role === "ADMIN") {
      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        // First-time admin — needs to set up 2FA before they can complete login.
        const pendingSecret = generateSecret();
        const challenge = createChallenge({
          userId: user.id,
          email: user.email,
          type: "setup",
          pendingSecret,
        });
        await logAction({
          actorId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          category: "auth",
          action: "auth.2fa.setup_requested",
          description: `Admin ${user.email} login pertama: diminta setup 2FA.`,
          outcome: "success",
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });
        return NextResponse.json({
          needsSetup: true,
          challengeToken: challenge.token,
          email: user.email,
          fullName: user.fullName,
        });
      }
      // Existing admin with 2FA enabled — needs TOTP verification.
      const challenge = createChallenge({
        userId: user.id,
        email: user.email,
        type: "verify",
      });
      await logAction({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        category: "auth",
        action: "auth.2fa.challenge_sent",
        description: `Admin ${user.email} password OK, menunggu verifikasi TOTP.`,
        outcome: "success",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return NextResponse.json({
        needsTwoFactor: true,
        challengeToken: challenge.token,
        email: user.email,
        fullName: user.fullName,
      });
    }

    // Non-admin: complete login immediately
    const token = generateSessionToken();
    const expiresAt = computeAbsoluteExpiry(user.role);
    await db.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
        lastActivityAt: new Date(),
        userAgent: req.headers.get("user-agent") ?? null,
        ipAddress: ip,
      },
    });

    // 🔒 Concurrent session limit: max 3 device per user
    // Hapus session tertua kalau melebihi limit (FIFO eviction)
    const MAX_SESSIONS = 3;
    const userSessions = await db.session.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { lastActivityAt: "desc" },
      select: { id: true },
    });
    if (userSessions.length > MAX_SESSIONS) {
      const toRevoke = userSessions.slice(MAX_SESSIONS); // ambil session tertua (di luar top 3)
      await db.session.deleteMany({
        where: { id: { in: toRevoke.map((s) => s.id) } },
      });
    }

    await setSessionCookie(token);

    await logAction({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      category: "auth",
      action: "auth.login.success",
      description: `Login berhasil sebagai ${user.role}: ${user.email}.`,
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { sessionId: token.slice(0, 8) + "…" },
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
    console.error("[login] error", err);
    return NextResponse.json({ error: "Terjadi kesalahan. Coba lagi." }, { status: 500 });
  }
}
