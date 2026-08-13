"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/shared/app-shell";
import { DashboardHeader } from "@/components/shared/dashboard-primitives";
import { DriverOrders } from "./driver-orders";
import { DriverEarnings } from "./driver-earnings";
import { UserProfileEditor } from "@/components/shared/user-profile-editor";
import { WalletPanel } from "@/components/wallet/wallet-panel";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { Bike, User } from "lucide-react";

export function DriverDashboard() {
  const user = useAuthStore((s) => s.user);
  const [activeNav, setActiveNav] = useState("available");

  return (
    <AppShell
      accent="mint"
      activeNav={activeNav}
      onNavChange={setActiveNav}
    >
      {activeNav !== "wallet" && activeNav !== "profile" && (
        <>
          <DashboardHeader
            greeting="Driver"
            name={user?.fullName ?? "Driver Rejo"}
            subtitle="Antar dengan cepat, aman, dan dapatkan penghasilan harian."
            accent="mint"
          />

          <div className="mb-4">
            <DriverEarnings />
          </div>

          <DriverOrders />
        </>
      )}

      {activeNav === "wallet" && (
        <>
          <DashboardHeader
            greeting="RejoPay"
            name={user?.fullName ?? "Driver Rejo"}
            subtitle="Penghasilanmu dari setiap pengiriman — cairkan kapan saja."
            accent="mint"
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
            name={user?.fullName ?? "Driver Rejo"}
            subtitle="Kelola informasi akun dan kendaraan."
            accent="mint"
          />
          <ErrorBoundary><UserProfileEditor /></ErrorBoundary>
        </>
      )}
    </AppShell>
  );
}
