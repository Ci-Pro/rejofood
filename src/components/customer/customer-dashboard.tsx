"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { AppShell } from "@/components/shared/app-shell";
import { DashboardHeader } from "@/components/shared/dashboard-primitives";
import { RestaurantGrid } from "./restaurant-grid";
import { CartButton } from "./cart-button";
import { MyOrdersList } from "./my-orders-list";
import { UtensilsCrossed, ShoppingBag, Heart, User } from "lucide-react";
import type { NavAccent } from "@/components/shared/nav-types";

export function CustomerDashboard() {
  const user = useAuthStore((s) => s.user);
  const [activeNav, setActiveNav] = useState("restaurants");

  return (
    <AppShell
      accent="saffron"
      activeNav={activeNav}
      onNavChange={setActiveNav}
    >
      {activeNav === "restaurants" && (
        <>
          <DashboardHeader
            greeting="Pelanggan"
            name={user?.fullName ?? "Sobat Rejo"}
            subtitle="Lagi lapar? Restoran favoritmu menanti."
            accent="saffron"
          />
          <section className="mb-5">
            <div className="accent-saffron mb-5 flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-role" />
              <h2 className="font-display text-lg font-700 text-foreground">Restoran terdekat</h2>
            </div>
            <RestaurantGrid />
          </section>
        </>
      )}

      {activeNav === "orders" && (
        <>
          <DashboardHeader
            greeting="Pesanan"
            name={user?.fullName ?? "Sobat Rejo"}
            subtitle="Pantau status pesananmu secara real-time."
            accent="saffron"
          />
          <MyOrdersList />
        </>
      )}

      {activeNav === "favorites" && (
        <>
          <DashboardHeader
            greeting="Favorit"
            name={user?.fullName ?? "Sobat Rejo"}
            subtitle="Restoran dan menu favoritmu."
            accent="saffron"
          />
          <div className="accent-saffron rounded-2xl border border-dashed border-role/40 bg-role-soft/30 p-8 text-center">
            <Heart className="mx-auto h-10 w-10 text-role" />
            <p className="mt-3 font-display text-lg font-700 text-foreground">Favorit segera hadir</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Simpan restoran dan menu favorit untuk akses cepat.
            </p>
          </div>
        </>
      )}

      {activeNav === "profile" && (
        <>
          <DashboardHeader
            greeting="Profil"
            name={user?.fullName ?? "Sobat Rejo"}
            subtitle="Kelola informasi akunmu."
            accent="saffron"
          />
          <div className="accent-saffron rounded-2xl border border-dashed border-role/40 bg-role-soft/30 p-8 text-center">
            <User className="mx-auto h-10 w-10 text-role" />
            <p className="mt-3 font-display text-lg font-700 text-foreground">Profil segera hadir</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Edit nama, nomor HP, alamat default, dan password.
            </p>
          </div>
        </>
      )}

      <CartButton />
    </AppShell>
  );
}
