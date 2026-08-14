/**
 * Setup admin user dengan credentials yang ditentukan.
 *
 * Jalankan dengan DATABASE_URL production (Neon):
 *   DATABASE_URL=postgresql://... bun run scripts/setup-admin.ts
 *
 * Atau set DATABASE_URL di .env dulu, lalu:
 *   bun run scripts/setup-admin.ts
 *
 * Admin yang dibuat:
 *   Email: rejofood@admin.com
 *   Password: rejofood@99
 *
 * Admin ini:
 *  - Tidak di-block di production (bukan demo email)
 *  - emailVerifiedAt diset (bypass verification untuk admin)
 *  - twoFactorEnabled = false (setup 2FA saat login pertama)
 *  - isActive = true
 *  - isFlagged = false
 */
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient();

const ADMIN_EMAIL = "rejofood@admin.com";
const ADMIN_PASSWORD = "rejofood@99";
const ADMIN_FULL_NAME = "RejoFood Admin";

async function main() {
  console.log("=== Setup Admin User ===");
  console.log(`Email: ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
  console.log("");

  const passwordHash = hashPassword(ADMIN_PASSWORD);

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
      emailVerifiedAt: new Date(), // bypass email verification untuk admin
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

  console.log("✅ Admin user berhasil dibuat/diupdate!");
  console.log("");
  console.log("Detail:");
  console.log(`  ID: ${user.id}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Nama: ${user.fullName}`);
  console.log(`  Role: ${user.role}`);
  console.log(`  Active: ${user.isActive}`);
  console.log(`  Email Verified: ${user.emailVerifiedAt ? "Yes" : "No"}`);
  console.log(`  2FA Enabled: ${user.twoFactorEnabled}`);
  console.log("");
  console.log("Cara login:");
  console.log("  1. Buka https://rejofood.vercel.app/?admin=1");
  console.log("  2. Login dengan email & password di atas");
  console.log("  3. Saat login pertama, setup 2FA TOTP");
  console.log("");
  console.log("⚠️  Ganti password ini setelah login pertama untuk keamanan!");
}

main()
  .catch((e) => {
    console.error("❌ Gagal setup admin:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
