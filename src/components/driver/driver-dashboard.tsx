"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/shared/app-shell";
import { DashboardHeader } from "@/components/shared/dashboard-primitives";
import { DriverOrders } from "./driver-orders";
import { UserProfileEditor } from "@/components/shared/user-profile-editor";
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
      <DashboardHeader
        greeting="Driver"
        name={user?.fullName ?? "Driver Rejo"}
        subtitle="Antar dengan cepat, aman, dan dapatkan penghasilan harian."
        accent="mint"
      />

      {(activeNav === "available" || activeNav === "active") && <DriverOrders />}

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
