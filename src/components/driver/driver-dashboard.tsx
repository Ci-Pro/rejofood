"use client";

import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/shared/app-shell";
import { DashboardHeader } from "@/components/shared/dashboard-primitives";
import { DriverOrders } from "./driver-orders";

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

      <div className="space-y-4">
        <DriverOrders />
      </div>
    </AppShell>
  );
}
