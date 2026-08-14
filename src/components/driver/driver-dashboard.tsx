"use client";

import { useState } from "react";
import { AppShell } from "@/components/shared/app-shell";
import { DashboardHeader } from "@/components/shared/dashboard-primitives";
import { DriverOrders } from "./driver-orders";
import { DriverEarnings } from "./driver-earnings";
import { UserProfileEditor } from "@/components/shared/user-profile-editor";
import { WalletPanel } from "@/components/wallet/wallet-panel";
import { ErrorBoundary } from "@/components/shared/error-boundary";

export function DriverDashboard() {
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
            greeting="Dashboard Driver"
            subtitle="Antar cepat, aman, dapat penghasilan."
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
            subtitle="Penghasilan pengiriman — cairkan kapan saja."
            accent="mint"
          />
          <ErrorBoundary>
            <WalletPanel showWithdraw accent="mint" />
          </ErrorBoundary>
        </>
      )}

      {activeNav === "profile" && (
        <>
          <DashboardHeader
            greeting="Profil"
            subtitle="Kelola akun & kendaraan."
            accent="mint"
          />
          <ErrorBoundary><UserProfileEditor /></ErrorBoundary>
        </>
      )}
    </AppShell>
  );
}
