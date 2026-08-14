"use client";

import { useState } from "react";
import { AppShell } from "@/components/shared/app-shell";
import { DashboardBanner } from "@/components/shared/dashboard-primitives";
import { DashboardHeader } from "@/components/shared/dashboard-primitives";
import { RestaurantGrid } from "./restaurant-grid";
import { CartButton } from "./cart-button";
import { MyOrdersList } from "./my-orders-list";
import { FavoritesList } from "./favorites-list";
import { UserProfileEditor } from "@/components/shared/user-profile-editor";
import { WalletPanel } from "@/components/wallet/wallet-panel";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { UtensilsCrossed } from "lucide-react";

export function CustomerDashboard() {
  const [activeNav, setActiveNav] = useState("restaurants");

  return (
    <AppShell
      accent="saffron"
      activeNav={activeNav}
      onNavChange={setActiveNav}
    >
      {activeNav === "restaurants" && (
        <>
          <DashboardBanner
            greeting="Lagi lapar?"
            subtitle="Restoran terdekat menantimu."
            accent="saffron"
          />
          <section className="mb-5">
            <div className="accent-saffron mb-3 flex items-center gap-2 sm:mb-4">
              <UtensilsCrossed className="h-4 w-4 text-role" />
              <h2 className="font-display text-base font-700 text-foreground sm:text-lg">Restoran terdekat</h2>
            </div>
            <RestaurantGrid />
          </section>
        </>
      )}

      {activeNav === "orders" && (
        <>
          <DashboardHeader
            greeting="Pesananmu"
            subtitle="Pantau status real-time."
            accent="saffron"
          />
          <MyOrdersList />
        </>
      )}

      {activeNav === "favorites" && (
        <>
          <DashboardHeader
            greeting="Favorit"
            subtitle="Restoran untuk akses cepat."
            accent="saffron"
          />
          <FavoritesList />
        </>
      )}

      {activeNav === "wallet" && (
        <>
          <DashboardHeader
            greeting="RejoPay"
            subtitle="Top-up, bayar, & lacak transaksi."
            accent="saffron"
          />
          <ErrorBoundary>
            <WalletPanel accent="saffron" />
          </ErrorBoundary>
        </>
      )}

      {activeNav === "profile" && (
        <>
          <DashboardHeader
            greeting="Profil"
            subtitle="Kelola akunmu."
            accent="saffron"
          />
          <ErrorBoundary><UserProfileEditor /></ErrorBoundary>
        </>
      )}

      <CartButton />
    </AppShell>
  );
}
