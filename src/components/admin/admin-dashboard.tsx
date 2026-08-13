"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/shared/app-shell";
import {
  StatTile,
  DashboardHeader,
} from "@/components/shared/dashboard-primitives";
import { AuditLogViewer } from "./audit-log-viewer";
import { OrderMonitor } from "./order-monitor";
import { UserManagement } from "./user-management";
import { AdminWalletManagement as WalletManagement } from "./wallet-management";
import { UserProfileEditor } from "@/components/shared/user-profile-editor";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { Users, Store, Bike, Activity, Loader2 } from "lucide-react";

interface AdminStats {
  users: { customers: number; merchants: number; drivers: number; admins: number };
  orders: { active: number; deliveredToday: number; gmvToday: number };
  reviews: { total: number; avgRating: number };
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

export function AdminDashboard() {
  const [activeNav, setActiveNav] = useState("orders");
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.users) setStats(d); })
      .catch(() => {});
  }, [activeNav]);

  return (
    <AppShell
      accent="rose"
      activeNav={activeNav}
      onNavChange={setActiveNav}
    >
      {activeNav === "orders" && (
        <>
          <DashboardHeader
            greeting="Dashboard Admin"
            subtitle="Pantau ekosistem RejoFood real-time."
            accent="rose"
          />

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile
              label="Pelanggan"
              value={stats ? stats.users.customers : <Loader2 className="h-4 w-4 animate-spin" />}
              hint="User aktif"
              icon={Users}
              accent="rose"
              delay={0.05}
            />
            <StatTile
              label="Merchant"
              value={stats ? stats.users.merchants : <Loader2 className="h-4 w-4 animate-spin" />}
              hint="Restoran aktif"
              icon={Store}
              accent="rose"
              delay={0.1}
            />
            <StatTile
              label="Driver"
              value={stats ? stats.users.drivers : <Loader2 className="h-4 w-4 animate-spin" />}
              hint="Driver aktif"
              icon={Bike}
              accent="rose"
              delay={0.15}
            />
            <StatTile
              label="GMV Hari Ini"
              value={stats ? formatRupiah(stats.orders.gmvToday) : <Loader2 className="h-4 w-4 animate-spin" />}
              hint={`${stats?.orders.deliveredToday ?? 0} order selesai · ${stats?.orders.active ?? 0} aktif`}
              icon={Activity}
              accent="rose"
              delay={0.2}
            />
          </div>

          {stats && stats.reviews.total > 0 && (
            <div className="mt-3 flex items-center gap-4 rounded-2xl border border-border bg-card p-3 text-xs text-muted-foreground">
              <span>Total ulasan: <span className="font-700 text-foreground">{stats.reviews.total}</span></span>
              <span>Rating rata-rata: <span className="font-700 text-saffron">★ {stats.reviews.avgRating}</span></span>
            </div>
          )}

          <div className="mt-6">
            <OrderMonitor />
          </div>
        </>
      )}

      {activeNav === "audit" && (
        <>
          <DashboardHeader
            greeting="Audit Log"
            subtitle="Jejak forensik aksi sensitif."
            accent="rose"
          />
          <AuditLogViewer />
        </>
      )}

      {activeNav === "wallets" && (
        <>
          <DashboardHeader
            greeting="Manajemen Dompet"
            subtitle="Pantau & kelola saldo RejoPay."
            accent="rose"
          />
          <ErrorBoundary>
            <WalletManagement />
          </ErrorBoundary>
        </>
      )}

      {activeNav === "profile" && (
        <>
          <DashboardHeader
            greeting="Profil Admin"
            subtitle="Kelola akun & user."
            accent="rose"
          />
          <div className="space-y-4">
            <ErrorBoundary><UserProfileEditor /></ErrorBoundary>
            <UserManagement />
          </div>
        </>
      )}
    </AppShell>
  );
}
