"use client";

import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/shared/app-shell";
import {
  StatTile,
  PlaceholderSection,
  DashboardHeader,
} from "@/components/shared/dashboard-primitives";
import { AuditLogViewer } from "./audit-log-viewer";
import { Users, Store, Bike, Activity } from "lucide-react";

export function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  return (
    <AppShell accent="rose">
      <DashboardHeader
        greeting="Admin"
        name={user?.fullName ?? "Admin Rejo"}
        subtitle="Pantau kesehatan ekosistem RejoFood secara real-time."
        accent="rose"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Pelanggan" value="—" hint="Data tersambung di iterasi berikut" icon={Users} accent="rose" delay={0.05} />
        <StatTile label="Merchant" value="—" hint="Restoran aktif" icon={Store} accent="rose" delay={0.1} />
        <StatTile label="Driver" value="—" hint="Driver online" icon={Bike} accent="rose" delay={0.15} />
        <StatTile label="GMV hari ini" value="—" hint="Nilai transaksi" icon={Activity} accent="rose" delay={0.2} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlaceholderSection
          title="Manajemen pengguna"
          description="Verifikasi, blokir, atau atur role pengguna lintas Pelanggan, Merchant, dan Driver."
          icon={Users}
          accent="rose"
        />
        <PlaceholderSection
          title="Operasional & insiden"
          description="Pantau anomali order, keluhan, dan performa driver/merchant secara menyeluruh."
          icon={Activity}
          accent="rose"
        />
      </div>

      <div className="mt-6">
        <AuditLogViewer />
      </div>
    </AppShell>
  );
}
