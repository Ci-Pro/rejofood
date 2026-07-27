"use client";

import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/shared/app-shell";
import {
  StatTile,
  PlaceholderSection,
  DashboardHeader,
} from "@/components/shared/dashboard-primitives";
import { UtensilsCrossed, ShoppingBag, MapPin, Heart } from "lucide-react";

export function CustomerDashboard() {
  const user = useAuthStore((s) => s.user);
  return (
    <AppShell accent="saffron">
      <DashboardHeader
        greeting="Pelanggan"
        name={user?.fullName ?? "Sobat Rejo"}
        subtitle="Lagi lapar? Restoran favoritmu menanti."
        accent="saffron"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Pesanan aktif" value="0" hint="Belum ada pesanan berjalan" icon={ShoppingBag} accent="saffron" delay={0.05} />
        <StatTile label="Restoran dekat" value="128" hint="Dalam radius 5 km" icon={MapPin} accent="saffron" delay={0.1} />
        <StatTile label="Favorit" value="6" hint="Restoran tersimpan" icon={Heart} accent="saffron" delay={0.15} />
        <StatTile label="Total order" value="24" hint="Sepanjang akun" icon={UtensilsCrossed} accent="saffron" delay={0.2} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlaceholderSection
          title="Cari makanan & restoran"
          description="Pencarian cerdas berdasarkan lokasi, kategori, dan riwayat order. Fondasi search akan ditambahkan pada iterasi berikutnya."
          icon={UtensilsCrossed}
          accent="saffron"
        />
        <PlaceholderSection
          title="Pesanan terakhir"
          description="Daftar pesananmu beserta status real-time (diproses, diantar, tiba). Siap diaktifkan setelah order pipeline tersambung."
          icon={ShoppingBag}
          accent="saffron"
        />
      </div>
    </AppShell>
  );
}
