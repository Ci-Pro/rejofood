/**
 * POST /api/auth/register
 * Body: { email, password, fullName, phone?, role, restaurantName?, vehicleType? }
 *
 * SECURITY: Role ADMIN tidak boleh dibuat lewat self-register.
 * Admin hanya bisa dibuat oleh admin lain via invite system (lihat lib/auth/context.ts → requireAdmin).
 * Setiap percobaan registrasi dengan role ADMIN akan ditolak dengan 403, terlepas dari UI.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { generateToken, setSessionCookie } from "@/lib/auth/session";
import { Role } from "@prisma/client";
import type { SafeUser } from "@/types/auth";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

export async function POST(req: Request) {
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
    if (password.length < MIN_PASSWORD) {
      return NextResponse.json({ error: `Password minimal ${MIN_PASSWORD} karakter.` }, { status: 400 });
    }
    if (fullName.length < 2) {
      return NextResponse.json({ error: "Nama lengkap minimal 2 karakter." }, { status: 400 });
    }
    if (!Object.values(Role).includes(role)) {
      return NextResponse.json({ error: "Role tidak valid." }, { status: 400 });
    }

    // 🔒 SECURITY: self-registration sebagai ADMIN dilarang keras.
    // Celah ini sebelumnya memungkinkan siapa saja menjadi admin hanya dengan POST { role: 'ADMIN' }.
    if (role === Role.ADMIN) {
      return NextResponse.json(
        { error: "Role Admin tidak dapat didaftarkan sendiri. Hubungi admin eksisting." },
        { status: 403 },
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
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
      // Role.ADMIN sengaja tidak ditangani di sini karena sudah ditolak di atas.
      // Jika suatu hari dibutuhkan invite flow, buat endpoint terpisah yang diawasi requireAdmin().
      return u;
    });

    const token = generateToken();
    await db.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        userAgent: req.headers.get("user-agent") ?? null,
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
    console.error("[register] error", err);
    return NextResponse.json({ error: "Terjadi kesalahan. Coba lagi." }, { status: 500 });
  }
}
