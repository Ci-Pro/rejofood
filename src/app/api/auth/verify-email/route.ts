/**
 * POST /api/auth/verify-email
 *
 * Verify email dengan token dari link email.
 *
 * Body: { token: string }
 *
 * Logic:
 *  1. Hash token, cari di EmailVerification table
 *  2. Cek token belum expired (24 jam)
 *  3. Cek token belum dipakai (usedAt = null)
 *  4. Update User.emailVerifiedAt = now
 *  5. Mark token as used
 *  6. Audit log
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { hashToken } from "@/lib/email/service";

const TOKEN_EXPIRY_HOURS = 24;

export async function POST(req: Request) {
  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body?.token) {
    return NextResponse.json({ error: "Token wajib diisi." }, { status: 400 });
  }

  const tokenHash = hashToken(String(body.token));

  const verification = await db.emailVerification.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, fullName: true, emailVerifiedAt: true } } },
  });

  if (!verification) {
    return NextResponse.json(
      { error: "Token tidak valid atau sudah dipakai.", code: "INVALID_TOKEN" },
      { status: 400 },
    );
  }

  // Cek sudah dipakai
  if (verification.usedAt) {
    return NextResponse.json(
      { error: "Token sudah dipakai. Email Anda sudah terverifikasi.", code: "ALREADY_USED" },
      { status: 400 },
    );
  }

  // Cek expired
  const expiresAt = new Date(verification.expiresAt);
  if (expiresAt < new Date()) {
    await db.emailVerification.delete({ where: { id: verification.id } }).catch(() => {});
    return NextResponse.json(
      { error: "Token sudah expired (lebih dari 24 jam). Silakan minta link verifikasi baru.", code: "EXPIRED" },
      { status: 400 },
    );
  }

  // Cek apakah user sudah verified (race condition check)
  if (verification.user.emailVerifiedAt) {
    return NextResponse.json({
      ok: true,
      alreadyVerified: true,
      message: "Email Anda sudah terverifikasi sebelumnya.",
    });
  }

  // Mark as verified
  await db.$transaction([
    db.user.update({
      where: { id: verification.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    db.emailVerification.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // Cleanup old tokens for this user (best effort)
  await db.emailVerification.deleteMany({
    where: {
      userId: verification.userId,
      usedAt: { not: null },
    },
  }).catch(() => {});

  await logAction({
    actorId: verification.userId,
    actorEmail: verification.user.email,
    category: "auth",
    action: "auth.email_verified",
    description: `Email ${verification.user.email} berhasil diverifikasi.`,
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({
    ok: true,
    message: "Email berhasil diverifikasi! Anda sekarang bisa login.",
    email: verification.user.email,
  });
}
