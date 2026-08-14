/**
 * POST /api/auth/register
 * Body: { email, password, fullName, phone?, role, restaurantName?, vehicleType? }
 *
 * SECURITY: Role ADMIN tidak boleh dibuat lewat self-register.
 * Setiap percobaan registrasi dengan role ADMIN akan ditolak dengan 403 dan dicatat di AuditLog.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { generateToken, setSessionCookie } from "@/lib/auth/session";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { computeAbsoluteExpiry } from "@/lib/auth/session-config";
import { validatePassword } from "@/lib/auth/password-policy";
import { Role } from "@prisma/client";
import type { SafeUser } from "@/types/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const meta = getRequestMeta(req);
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const role = String(body.role ?? "") as Role;

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
    }
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      return NextResponse.json(
        { error: pwdCheck.errors.join(" ") },
        { status: 400 },
      );
    }
    if (fullName.length < 2) {
      return NextResponse.json({ error: "Nama lengkap minimal 2 karakter." }, { status: 400 });
    }
    if (!Object.values(Role).includes(role)) {
      return NextResponse.json({ error: "Role tidak valid." }, { status: 400 });
    }

    // 🔒 SECURITY: self-registration sebagai ADMIN dilarang keras.
    if (role === Role.ADMIN) {
      await logAction({
        actorEmail: email,
        category: "auth",
        action: "auth.register.denied",
        description: `Percobaan self-register sebagai ADMIN ditolak untuk email ${email}.`,
        outcome: "denied",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { attemptedRole: "ADMIN" },
      });
      return NextResponse.json(
        { error: "Role Admin tidak dapat didaftarkan sendiri. Hubungi admin eksisting." },
        { status: 403 },
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      await logAction({
        actorEmail: email,
        category: "auth",
        action: "auth.register.failed",
        description: `Registrasi gagal: email ${email} sudah terdaftar.`,
        outcome: "failure",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
    }

    const passwordHash = hashPassword(password);
    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email, passwordHash, fullName, phone, role: role as Role },
      });
      if (role === Role.CUSTOMER) {
        await tx.customer.create({ data: { userId: u.id } });
      } else if (role === Role.MERCHANT) {
        const restaurantName = String(body.restaurantName ?? "").trim() || "Restoran Saya";
        await tx.merchant.create({
          data: { userId: u.id, restaurantName, isOpen: false },
        });
      } else if (role === Role.DRIVER) {
        const vehicleType = (body.vehicleType as string) || "motorcycle";
        await tx.driver.create({ data: { userId: u.id, vehicleType } });
      }
      return u;
    });

    const token = generateToken();
    await db.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt: computeAbsoluteExpiry(user.role),
        lastActivityAt: new Date(),
        userAgent: req.headers.get("user-agent") ?? null,
      },
    });
    await setSessionCookie(token);

    await logAction({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      category: "auth",
      action: "auth.register.success",
      description: `Registrasi berhasil: ${user.email} sebagai ${user.role}.`,
      targetId: user.id,
      targetType: "user",
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { role: user.role },
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
    console.error("[register] error", err);
    return NextResponse.json({ error: "Terjadi kesalahan. Coba lagi." }, { status: 500 });
  }
}
