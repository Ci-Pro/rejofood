/**
 * Seed script: inserts 4 demo users (one per role) into the SQLite DB.
 * Run with: `bun run scripts/seed-users.ts`
 *
 * Idempotent — safe to re-run.
 */
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient();

const DEMO_PASSWORD = "rejo1234";

async function main() {
  const seed = [
    {
      email: "customer@rejofood.id",
      fullName: "Budi Pelanggan",
      phone: "+628110000001",
      role: Role.CUSTOMER,
    },
    {
      email: "merchant@rejofood.id",
      fullName: "Sari Merchant",
      phone: "+628110000002",
      role: Role.MERCHANT,
    },
    {
      email: "driver@rejofood.id",
      fullName: "Andi Driver",
      phone: "+628110000003",
      role: Role.DRIVER,
    },
    {
      email: "admin@rejofood.id",
      fullName: "Rina Admin",
      phone: "+628110000004",
      role: Role.ADMIN,
    },
  ];

  const passwordHash = hashPassword(DEMO_PASSWORD);

  for (const u of seed) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: { passwordHash, fullName: u.fullName, phone: u.phone, role: u.role, isActive: true },
      create: { ...u, passwordHash },
    });

    // Ensure role-specific profile exists
    if (u.role === Role.CUSTOMER) {
      await db.customer.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, defaultAddress: "Jl. Rejo Pangan No. 1, Jakarta" },
      });
    } else if (u.role === Role.MERCHANT) {
      await db.merchant.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          restaurantName: "Warung Rejo Pangan",
          description: "Masakan rumahan khas Nusantara",
          rating: 4.8,
          isOpen: true,
        },
      });
    } else if (u.role === Role.DRIVER) {
      await db.driver.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          vehicleType: "motorcycle",
          vehiclePlate: "B 1234 RF",
          isOnline: true,
          rating: 4.9,
        },
      });
    } else if (u.role === Role.ADMIN) {
      await db.admin.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, permissions: JSON.stringify(["*"]) },
      });
    }
  }

  console.log("Seeded 4 demo users. Password for all:", DEMO_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
