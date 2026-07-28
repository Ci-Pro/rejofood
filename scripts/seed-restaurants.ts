/**
 * Seed demo restaurants + menu items.
 * Customer demo user tetap, tapi sekarang punya 5 restoran untuk dibrowse.
 * Merchant demo sudah punya 1 restoran (Warung Rejo Pangan) — kita isi menunya.
 * Tambah 4 restoran baru (dummy merchant users).
 *
 * Idempotent — aman dijalankan ulang.
 */
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient();
const PASSWORD = "rejo1234";

interface MenuSeed {
  name: string;
  description?: string;
  price: number;
  category: string;
}

interface RestaurantSeed {
  email: string;
  fullName: string;
  phone: string;
  restaurantName: string;
  description: string;
  address: string;
  cuisine: string;
  rating: number;
  isOpen: boolean;
  menu: MenuSeed[];
}

const RESTAURANTS: RestaurantSeed[] = [
  {
    email: "merchant@rejofood.id",
    fullName: "Sari Merchant",
    phone: "+628110000002",
    restaurantName: "Warung Rejo Pangan",
    description: "Masakan rumahan khas Nusantara dengan bahan segar pilihan.",
    address: "Jl. Rejo Pangan No. 12, Jakarta",
    cuisine: "Indonesia",
    rating: 4.8,
    isOpen: true,
    menu: [
      { name: "Nasi Goreng Spesial", description: "Nasi goreng dengan ayam, telur, dan kerupuk.", price: 25000, category: "Makanan" },
      { name: "Mie Goreng Jawa", description: "Mie goreng manis pedas khas Jawa Timur.", price: 22000, category: "Makanan" },
      { name: "Soto Ayam Lamongan", description: "Soto ayam bening dengan koya.", price: 28000, category: "Makanan" },
      { name: "Ayam Bakar Taliwang", description: "Ayam bakar bumbu pedas khas Lombok.", price: 35000, category: "Makanan" },
      { name: "Es Teh Manis", description: "Teh manis dingin segar.", price: 5000, category: "Minuman" },
      { name: "Es Jeruk Peras", description: "Jeruk peras asli, dingin.", price: 8000, category: "Minuman" },
      { name: "Klepon", description: "Kue ketan berisi gula merah, taburan kelapa.", price: 12000, category: "Dessert" },
    ],
  },
  {
    email: "padang@rejofood.id",
    fullName: "Haji Padang",
    phone: "+628110000010",
    restaurantName: "Rumah Makan Padang Sederhana",
    description: "Autentik masakan Padang, rendang merakyat.",
    address: "Jl. Minang No. 5, Jakarta",
    cuisine: "Padang",
    rating: 4.7,
    isOpen: true,
    menu: [
      { name: "Rendang Sapi", description: "Daging sapi dimasak rendang 8 jam.", price: 38000, category: "Makanan" },
      { name: "Ayam Pop", description: "Ayam rebus bumbu kuning, bersama sambal ijo.", price: 30000, category: "Makanan" },
      { name: "Gulai Tunjang", description: "Gulai kikil sapi khas Padang.", price: 32000, category: "Makanan" },
      { name: "Nasi Putih", price: 6000, category: "Makanan" },
      { name: "Teh Tarik", price: 8000, category: "Minuman" },
    ],
  },
  {
    email: "chinese@rejofood.id",
    fullName: "Aiko Chinese",
    phone: "+628110000020",
    restaurantName: "Dimsum House Jakarta",
    description: "Dimsum steamer fresh, dimasak pagi setiap hari.",
    address: "Jl. Mangga Besar No. 88, Jakarta",
    cuisine: "Chinese",
    rating: 4.6,
    isOpen: true,
    menu: [
      { name: "Siomay Ayam (4 pcs)", description: "Siomay ayam udang, steamed.", price: 28000, category: "Makanan" },
      { name: "Hakao Udang (4 pcs)", description: "Hakao transparan isi udang.", price: 32000, category: "Makanan" },
      { name: "Chicken Feet Dimsum", description: "Cakar ayam dalam saus black bean.", price: 25000, category: "Makanan" },
      { name: "Nasi Goreng Seafood", price: 35000, category: "Makanan" },
      { name: "Cap Cay Seafood", price: 38000, category: "Makanan" },
      { name: "Es Jeruk", price: 8000, category: "Minuman" },
    ],
  },
  {
    email: "coffee@rejofood.id",
    fullName: "Kopi Tutup",
    phone: "+628110000030",
    restaurantName: "Kopi Tutup Coffee House",
    description: "Specialty coffee + light meals. Tempat ngopi santai.",
    address: "Jl. Cikini Raya No. 22, Jakarta",
    cuisine: "Cafe",
    rating: 4.9,
    isOpen: false,
    menu: [
      { name: "Es Kopi Susu Tutup", description: "Signature: espresso, susu segar, gula aren.", price: 25000, category: "Minuman" },
      { name: "Americano", description: "Single origin Aceh Gayo.", price: 22000, category: "Minuman" },
      { name: "Cappuccino", price: 28000, category: "Minuman" },
      { name: "Croissant Almond", description: "Croissant butter dengan almond slice.", price: 25000, category: "Snack" },
      { name: "Cheesecake Strawberry", price: 32000, category: "Dessert" },
    ],
  },
  {
    email: "vegan@rejofood.id",
    fullName: "Bumi Vegan",
    phone: "+628110000040",
    restaurantName: "Bumi Vegan Kitchen",
    description: "Plant-based dishes. 100% vegan, tanpa MSG.",
    address: "Jl. Kemang Raya No. 7, Jakarta",
    cuisine: "Vegan",
    rating: 4.5,
    isOpen: true,
    menu: [
      { name: "Buddha Bowl Quinoa", description: "Quinoa, avocado, chickpea, sayuran panggang.", price: 42000, category: "Makanan" },
      { name: "Vegan Rendang Jackfruit", description: "Rendang nangka, santan kara.", price: 38000, category: "Makanan" },
      { name: "Smoothie Bowl Berry", price: 35000, category: "Dessert" },
      { name: "Cold-pressed Green Juice", price: 28000, category: "Minuman" },
    ],
  },
];

async function main() {
  const passwordHash = hashPassword(PASSWORD);

  for (const r of RESTAURANTS) {
    // Upsert merchant user
    const user = await db.user.upsert({
      where: { email: r.email },
      update: { passwordHash, fullName: r.fullName, phone: r.phone, role: Role.MERCHANT, isActive: true },
      create: { email: r.email, passwordHash, fullName: r.fullName, phone: r.phone, role: Role.MERCHANT },
    });

    // Upsert merchant profile
    const merchant = await db.merchant.upsert({
      where: { userId: user.id },
      update: {
        restaurantName: r.restaurantName,
        description: r.description,
        address: r.address,
        cuisine: r.cuisine,
        rating: r.rating,
        isOpen: r.isOpen,
      },
      create: {
        userId: user.id,
        restaurantName: r.restaurantName,
        description: r.description,
        address: r.address,
        cuisine: r.cuisine,
        rating: r.rating,
        isOpen: r.isOpen,
      },
    });

    // Reset menu items (delete all, re-create) — safe karena seed
    await db.menuItem.deleteMany({ where: { merchantId: merchant.id } });
    for (const m of r.menu) {
      await db.menuItem.create({
        data: {
          merchantId: merchant.id,
          name: m.name,
          description: m.description,
          price: m.price,
          category: m.category,
          isAvailable: true,
        },
      });
    }

    console.log(`  ✓ ${r.restaurantName} — ${r.menu.length} menu items`);
  }

  console.log("\nSeeded 5 restaurants + 27 menu items.");
  console.log("Demo merchant login: merchant@rejofood.id / rejo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
