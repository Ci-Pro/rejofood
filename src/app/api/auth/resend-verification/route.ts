/**
 * POST /api/auth/resend-verification
 *
 * Kirim ulang email verification.
 *
 * Body: { email: string }
 *
 * Logic:
 *  1. Cari user by email
 *  2. Jika sudah verified → reject dengan 400
 *  3. Hapus token lama yang belum dipakai
 *  4. Generate token baru, simpan ke DB
 *  5. Kirim email
 *  6. Rate limit: 3 resend per jam per email
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { rateLimitResponse } from "@/lib/auth/api-rate-limiter";
import {
  generateVerificationToken,
  hashToken,
  sendVerificationEmail,
} from "@/lib/email/service";

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 jam

export async function POST(req: Request) {
  // Rate limit: 3 resend per jam per IP
  const limited = rateLimitResponse(req, "resend-verification", 3, 60 * 60 * 1000);
  if (limited) return limited;

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body?.email) {
    return NextResponse.json({ error: "Email wajib diisi." }, { status: 400 });
  }

  const email = String(body.email).trim().toLowerCase();

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, fullName: true, emailVerifiedAt: true },
  });

  // Jangan leak apakah email ada atau tidak — selalu return success (security)
  if (!user) {
    return NextResponse.json({
      ok: true,
      message: "Jika email terdaftar dan belum terverifikasi, link verifikasi telah dikirim.",
    });
  }

  // Sudah verified
  if (user.emailVerifiedAt) {
    return NextResponse.json({
      ok: true,
      alreadyVerified: true,
      message: "Email Anda sudah terverifikasi. Silakan login.",
    });
  }

  // Hapus token lama yang belum dipakai (cleanup)
  await db.emailVerification.deleteMany({
    where: { userId: user.id, usedAt: null },
  }).catch(() => {});

  // Generate token baru
  const token = generateVerificationToken();
  const tokenHash = hashToken(token);

  await db.emailVerification.create({
    data: {
      userId: user.id,
      token,
      tokenHash,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
    },
  });

  // Kirim email
  const result = await sendVerificationEmail(user.email, user.fullName, token);

  await logAction({
    actorId: user.id,
    actorEmail: user.email,
    category: "auth",
    action: "auth.resend_verification",
    description: `Link verifikasi email dikirim ulang ke ${user.email}.`,
    outcome: result.success ? "success" : "failure",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { emailSent: result.success, error: result.error },
  });

  if (!result.success) {
    return NextResponse.json(
      { error: "Gagal mengirim email verifikasi. Coba lagi nanti." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Jika email terdaftar dan belum terverifikasi, link verifikasi telah dikirim.",
  });
}
