/**
 * POST /api/auth/login
 * Body: { email, password, expectedRole? }
 *
 * Returns the safe user object on success. Sets the session cookie.
 *
 * SECURITY:
 *  - `expectedRole` hanya UX; server memverifikasi password secara terpisah.
 *  - Saat env `REJO_DEMO_MODE !== 'true'` (production default), email demo admin
 *    (`admin@rejofood.id`) ditolak meskipun password benar.
 *  - Rate limit: 5 percobaan gagal / 15 menit per (IP, email) → lockout 30 menit.
 *    Setiap response gagal mengembalikan `remainingAttempts` untuk UX.
 *    Lapisan berikutnya yang belum diimplementasi: 2FA, idle timeout, audit log.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { generateToken, setSessionCookie } from "@/lib/auth/session";
import {
  checkRateLimit,
  recordFailure,
  recordSuccess,
  getClientIp,
} from "@/lib/auth/rate-limiter";
import { Role } from "@prisma/client";
import type { SafeUser } from "@/types/auth";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const DEMO_BLOCKED_EMAILS = new Set(["admin@rejofood.id"]);

function isDemoMode(): boolean {
  return process.env.REJO_DEMO_MODE === "true";
}

/** Format sisa waktu lockout ke "Xm Ys" atau "Xs" untuk pesan UI. */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} detik`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m} menit ${s} detik` : `${m} menit`;
}

export async function POST(req: Request) {
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
      // Hitung sebagai failure agar tidak bisa di-brute-force untuk cek keberadaan akun
      const after = recordFailure(ip, email);
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
      // Jangan beri tahu email ada/tidak — pesan generik
      const isLocked = after.lockedUntil !== null;
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
      // Role mismatch TIDAK dihitung sebagai failure — itu bukan serangan, hanya UX
      return NextResponse.json(
        {
          error: `Akun ini bukan role ${body.expectedRole}. Silakan pilih role yang sesuai.`,
          code: "ROLE_MISMATCH",
        },
        { status: 403 },
      );
    }

    // ✅ Sukses — reset counter agar user tidak terbebani history gagal lama
    recordSuccess(ip, email);

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
        userAgent: req.headers.get("user-agent") ?? null,
        ipAddress: ip,
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
    console.error("[login] error", err);
    return NextResponse.json({ error: "Terjadi kesalahan. Coba lagi." }, { status: 500 });
  }
}
