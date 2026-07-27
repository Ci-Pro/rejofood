/**
 * POST /api/auth/login
 * Body: { email, password, expectedRole? }
 *
 * Returns the safe user object on success. Sets the session cookie.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { generateToken, setSessionCookie } from "@/lib/auth/session";
import { Role } from "@prisma/client";
import type { SafeUser } from "@/types/auth";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
      return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }
    if (!verifyPassword(body.password, user.passwordHash)) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    if (body.expectedRole && user.role !== (body.expectedRole as Role)) {
      return NextResponse.json(
        { error: `Akun ini bukan role ${body.expectedRole}. Silakan pilih role yang sesuai.` },
        { status: 403 },
      );
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
        userAgent: req.headers.get("user-agent") ?? null,
        ipAddress: req.headers.get("x-forwarded-for") ?? null,
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
