"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/shared/app-shell";
import { DashboardHeader } from "@/components/shared/dashboard-primitives";
import { ProfileEditor } from "./profile-editor";
import { MenuManager } from "./menu-manager";
import { OrderQueue } from "./order-queue";
import { MerchantReviews } from "./merchant-reviews";
import { RevenueSummary } from "./revenue-summary";
import { DailyOrdersChart } from "./daily-orders-chart";
import { UserProfileEditor } from "@/components/shared/user-profile-editor";
import { WalletPanel } from "@/components/wallet/wallet-panel";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import type { MerchantInfo } from "./menu-manager-bridge";

export function MerchantDashboard() {
  const user = useAuthStore((s) => s.user);
  const [info, setInfo] = useState<MerchantInfo | null>(null);
  const [activeNav, setActiveNav] = useState("orders");
  const [pendingCount, setPendingCount] = useState(0);

  // Listen for pending order count (dari OrderQueue via callback)
  // Untuk simplicity, OrderQueue set badge via window event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      setPendingCount(detail);
    };
    window.addEventListener("rejofood:pending-orders", handler);
    return () => window.removeEventListener("rejofood:pending-orders", handler);
  }, []);

  const navBadges = {
    orders: pendingCount,
  };

  return (
    <AppShell
      accent="lavender"
      activeNav={activeNav}
      onNavChange={setActiveNav}
      navBadges={navBadges}
    >
      {activeNav === "orders" && (
        <>
          <DashboardHeader
            greeting="Merchant"
            name={user?.fullName ?? "Partner Rejo"}
            subtitle="Pantau restoran dan kelola pesanan masuk di satu layar."
            accent="lavender"
          />
          <div className="space-y-4">
            <RevenueSummary />
            <DailyOrdersChart />
            <ProfileEditor info={info} onUpdated={setInfo} />
            <OrderQueue onPendingCountChange={setPendingCount} />
          </div>
        </>
      )}

      {activeNav === "menu" && (
        <>
          <DashboardHeader
            greeting="Menu"
            name={user?.fullName ?? "Partner Rejo"}
            subtitle="Kelola daftar menu restoranmu."
            accent="lavender"
          />
          <div className="space-y-4">
            <MerchantReviews />
            <MenuManager onInfoLoaded={setInfo} />
          </div>
        </>
      )}

      {activeNav === "wallet" && (
        <>
          <DashboardHeader
            greeting="RejoPay"
            name={user?.fullName ?? "Partner Rejo"}
            subtitle="Saldo penjualan restoranmu — cairkan kapan saja."
            accent="lavender"
          />
          <ErrorBoundary>
            <WalletPanel showWithdraw />
          </ErrorBoundary>
        </>
      )}

      {activeNav === "profile" && (
        <>
          <DashboardHeader
            greeting="Profil"
            name={user?.fullName ?? "Partner Rejo"}
            subtitle="Kelola informasi akun dan restoran."
            accent="lavender"
          />
          <div className="space-y-4">
            <ErrorBoundary><UserProfileEditor /></ErrorBoundary>
            <ProfileEditor info={info} onUpdated={setInfo} />
          </div>
        </>
      )}
    </AppShell>
  );
}
