"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/shared/app-shell";
import { DashboardHeader } from "@/components/shared/dashboard-primitives";
import { DriverOrders } from "./driver-orders";
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
      <DashboardHeader
        greeting="Driver"
        name={user?.fullName ?? "Driver Rejo"}
        subtitle="Antar dengan cepat, aman, dan dapatkan penghasilan harian."
        accent="mint"
      />

      {(activeNav === "available" || activeNav === "active") && <DriverOrders />}

      {activeNav === "profile" && (
        <div className="accent-mint rounded-2xl border border-dashed border-role/40 bg-role-soft/30 p-8 text-center">
          <User className="mx-auto h-10 w-10 text-role" />
          <p className="mt-3 font-display text-lg font-700 text-foreground">Profil segera hadir</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit nama, kendaraan, dan lihat riwayat penghasilan.
          </p>
        </div>
      )}
    </AppShell>
  );
}
