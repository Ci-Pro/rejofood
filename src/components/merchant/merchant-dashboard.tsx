"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/shared/app-shell";
import { DashboardHeader } from "@/components/shared/dashboard-primitives";
import { ProfileEditor } from "./profile-editor";
import { MenuManager } from "./menu-manager";
import type { MerchantInfo } from "./menu-manager-bridge";

export function MerchantDashboard() {
  const user = useAuthStore((s) => s.user);
  const [info, setInfo] = useState<MerchantInfo | null>(null);

  return (
    <AppShell accent="lavender">
      <DashboardHeader
        greeting="Merchant"
        name={user?.fullName ?? "Partner Rejo"}
        subtitle="Pantau restoran dan kelola pesanan masuk di satu layar."
        accent="lavender"
      />

      <div className="space-y-4">
        <ProfileEditor info={info} onUpdated={setInfo} />
        <MenuManager onInfoLoaded={setInfo} />
      </div>
    </AppShell>
  );
}
