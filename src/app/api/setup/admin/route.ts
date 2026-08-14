/**
 * POST /api/setup/admin
 *
 * Bootstrap admin user di production.
 *
 * Body: { setupKey: string }
 *
 * Logic:
 *  1. Cek setupKey — harus match ADMIN_SETUP_KEY env var
 *     (default: "rejofood-setup-2026")
 *  2. Cek apakah admin sudah ada (rejofood@admin.com)
 *  3. Jika belum, create admin
 *  4. Jika sudah, update password
 *  5. Return success
 *
 * Security:
 *  - Setup key dari env var (ganti di production!)
 *  - Endpoint ini hanya untuk bootstrap awal
 *  - Setelah admin dibuat, sebaiknya hapus endpoint atau set ADMIN_SETUP_KEY=random
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { Role } from "@prisma/client";

const ADMIN_SETUP_KEY = process.env.ADMIN_SETUP_KEY || "rejofood-setup-2026";

const ADMIN_EMAIL = "rejofood@admin.com";
const ADMIN_PASSWORD = "rejofood@99";
const ADMIN_FULL_NAME = "RejoFood Admin";

export async function POST(req: Request) {
  const meta = getRequestMeta(req);

  // Parse body (accept JSON atau query param)
  let setupKey: string | null = null;

  // Try JSON body first
  try {
    const body = await req.json();
    setupKey = body?.setupKey ?? null;
  } catch {
    // Try query param
    const url = new URL(req.url);
    setupKey = url.searchParams.get("key");
  }

  if (!setupKey || setupKey !== ADMIN_SETUP_KEY) {
    return NextResponse.json(
      { error: "Setup key tidak valid." },
      { status: 403 },
    );
  }

  const passwordHash = hashPassword(ADMIN_PASSWORD);

  try {
    // Upsert admin user
    const user = await db.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        passwordHash,
        fullName: ADMIN_FULL_NAME,
        role: Role.ADMIN,
        isActive: true,
        isFlagged: false,
        flagReason: null,
        emailVerifiedAt: new Date(),
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
      create: {
        email: ADMIN_EMAIL,
        passwordHash,
        fullName: ADMIN_FULL_NAME,
        role: Role.ADMIN,
        isActive: true,
        emailVerifiedAt: new Date(),
        twoFactorEnabled: false,
      },
    });

    // Ensure admin profile exists
    await db.admin.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        permissions: JSON.stringify(["*"]),
      },
    });

    await logAction({
      actorEmail: ADMIN_EMAIL,
      actorRole: Role.ADMIN,
      category: "auth",
      action: "admin.bootstrap",
      description: `Admin user bootstrap: ${ADMIN_EMAIL}`,
      outcome: "success",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({
      ok: true,
      message: "Admin berhasil dibuat/diupdate.",
      admin: {
        email: ADMIN_EMAIL,
        fullName: ADMIN_FULL_NAME,
        role: "ADMIN",
        isActive: user.isActive,
        emailVerified: !!user.emailVerifiedAt,
      },
      loginUrl: "/?admin=1",
    });
  } catch (err) {
    console.error("[setup/admin] error:", err);
    return NextResponse.json(
      { error: "Gagal setup admin. Cek server logs." },
      { status: 500 },
    );
  }
}

// GET juga support untuk akses via browser
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (!key || key !== ADMIN_SETUP_KEY) {
    return NextResponse.json(
      { error: "Setup key tidak valid. Akses dengan ?key=ADMIN_SETUP_KEY" },
      { status: 403 },
    );
  }

  // Re-run POST logic
  return POST(req);
}
