"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/shared/app-shell";
import {
  StatTile,
  DashboardHeader,
} from "@/components/shared/dashboard-primitives";
import { AuditLogViewer } from "./audit-log-viewer";
import { OrderMonitor } from "./order-monitor";
import { UserProfileEditor } from "@/components/shared/user-profile-editor";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { Users, Store, Bike, Activity } from "lucide-react";

export function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const [activeNav, setActiveNav] = useState("orders");

  return (
    <AppShell
      accent="rose"
      activeNav={activeNav}
      onNavChange={setActiveNav}
    >
      {activeNav === "orders" && (
        <>
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

          <div className="mt-6">
            <OrderMonitor />
          </div>
        </>
      )}

      {activeNav === "audit" && (
        <>
          <DashboardHeader
            greeting="Audit Log"
            name={user?.fullName ?? "Admin Rejo"}
            subtitle="Jejak forensik semua aksi sensitif."
            accent="rose"
          />
          <AuditLogViewer />
        </>
      )}

      {activeNav === "profile" && (
        <>
          <DashboardHeader
            greeting="Profil"
            name={user?.fullName ?? "Admin Rejo"}
            subtitle="Kelola informasi akun admin."
            accent="rose"
          />
          <ErrorBoundary><UserProfileEditor /></ErrorBoundary>
        </>
      )}
    </AppShell>
  );
}
