"use client";

import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/shared/app-shell";
import {
  StatTile,
  PlaceholderSection,
  DashboardHeader,
} from "@/components/shared/dashboard-primitives";
import { Store, Receipt, Utensils, Star } from "lucide-react";

export function MerchantDashboard() {
  const user = useAuthStore((s) => s.user);
  return (
    <AppShell accent="lavender">
      <DashboardHeader
        greeting="Merchant"
        name={user?.fullName ?? "Partner Rejo"}
        subtitle="Pantau restoran dan kelola pesanan masuk di satu layar."
        accent="lavender"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Pesanan hari ini" value="0" hint="Belum ada order" icon={Receipt} accent="lavender" delay={0.05} />
        <StatTile label="Menu aktif" value="0" hint="Belum ada menu" icon={Utensils} accent="lavender" delay={0.1} />
        <StatTile label="Rating" value="—" hint="Belum ada ulasan" icon={Star} accent="lavender" delay={0.15} />
        <StatTile label="Status toko" value="Tutup" hint="Buka untuk menerima order" icon={Store} accent="lavender" delay={0.2} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlaceholderSection
          title="Kelola menu"
          description="Tambah, edit, dan kategorikan menu. Lengkapi dengan foto, harga, dan ketersediaan harian."
          icon={Utensils}
          accent="lavender"
        />
        <PlaceholderSection
          title="Antrian pesanan"
          description="Terima atau tolak order secara real-time, atur status persiapan, dan koordinasi dengan driver."
          icon={Receipt}
          accent="lavender"
        />
      </div>
    </AppShell>
  );
}
