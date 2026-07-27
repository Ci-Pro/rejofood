"use client";

import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/shared/app-shell";
import {
  StatTile,
  PlaceholderSection,
  DashboardHeader,
} from "@/components/shared/dashboard-primitives";
import { Bike, Package, Wallet, Clock } from "lucide-react";

export function DriverDashboard() {
  const user = useAuthStore((s) => s.user);
  return (
    <AppShell accent="mint">
      <DashboardHeader
        greeting="Driver"
        name={user?.fullName ?? "Driver Rejo"}
        subtitle="Antar dengan cepat, aman, dan dapatkan penghasilan harian."
        accent="mint"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Pengiriman hari ini" value="0" hint="Belum ada order" icon={Package} accent="mint" delay={0.05} />
        <StatTile label="Status online" value="Offline" hint="Aktifkan untuk menerima order" icon={Bike} accent="mint" delay={0.1} />
        <StatTile label="Pendapatan" value="Rp 0" hint="Hari ini" icon={Wallet} accent="mint" delay={0.15} />
        <StatTile label="Rata-rata antar" value="—" hint="Belum ada data" icon={Clock} accent="mint" delay={0.2} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlaceholderSection
          title="Antrian pengiriman"
          description="Lihat order yang siap dijemput dengan rute optimal dan estimasi waktu tempuh."
          icon={Package}
          accent="mint"
        />
        <PlaceholderSection
          title="Riwayat & pendapatan"
          description="Catatan pengiriman dan setoran harian/mingguan, lengkap dengan rating pelanggan."
          icon={Wallet}
          accent="mint"
        />
      </div>
    </AppShell>
  );
}
