"use client";

import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/shared/app-shell";
import { DashboardHeader } from "@/components/shared/dashboard-primitives";
import { RestaurantGrid } from "./restaurant-grid";
import { UtensilsCrossed } from "lucide-react";

export function CustomerDashboard() {
  const user = useAuthStore((s) => s.user);
  return (
    <AppShell accent="saffron">
      <DashboardHeader
        greeting="Pelanggan"
        name={user?.fullName ?? "Sobat Rejo"}
        subtitle="Lagi lapar? Restoran favoritmu menanti."
        accent="saffron"
      />

      <section className="mb-5">
        <div className="accent-saffron flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-role" />
          <h2 className="font-display text-lg font-700 text-foreground">Restoran terdekat</h2>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pilih restoran untuk melihat menu dan memesan.
        </p>
      </section>

      <RestaurantGrid />
    </AppShell>
  );
}
