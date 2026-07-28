"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/shared/app-shell";
import { DashboardHeader } from "@/components/shared/dashboard-primitives";
import { ProfileEditor } from "./profile-editor";
import { MenuManager } from "./menu-manager";
import { OrderQueue } from "./order-queue";
import { UserProfileEditor } from "@/components/shared/user-profile-editor";
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
            <ProfileEditor info={info} onUpdated={setInfo} />
            <MenuManager onInfoLoaded={setInfo} />
          </div>
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
            <UserProfileEditor />
            <ProfileEditor info={info} onUpdated={setInfo} />
          </div>
        </>
      )}
    </AppShell>
  );
}
