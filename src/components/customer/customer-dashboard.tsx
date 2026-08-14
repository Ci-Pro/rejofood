"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/shared/app-shell";
import { DashboardHeader } from "@/components/shared/dashboard-primitives";
import { RestaurantGrid } from "./restaurant-grid";
import { CartButton } from "./cart-button";
import { MyOrdersList } from "./my-orders-list";
import { FavoritesList } from "./favorites-list";
import { UserProfileEditor } from "@/components/shared/user-profile-editor";
import { WalletPanel } from "@/components/wallet/wallet-panel";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { useAuthStore } from "@/store/auth-store";
import { UtensilsCrossed, Coffee, Pizza, Soup, Cake, Fish, Wheat } from "lucide-react";

const CATEGORIES = [
  { icon: UtensilsCrossed, label: "Semua", value: "" },
  { icon: Soup, label: "Indonesia", value: "Indonesia" },
  { icon: Wheat, label: "Chinese", value: "Chinese" },
  { icon: Pizza, label: "Western", value: "Western" },
  { icon: Fish, label: "Seafood", value: "Seafood" },
  { icon: Coffee, label: "Minuman", value: "Minuman" },
  { icon: Cake, label: "Dessert", value: "Dessert" },
];

export function CustomerDashboard() {
  const [activeNav, setActiveNav] = useState("restaurants");
  const user = useAuthStore((s) => s.user);
  const [activeCategory, setActiveCategory] = useState("");

  return (
    <AppShell
      accent="saffron"
      activeNav={activeNav}
      onNavChange={setActiveNav}
    >
      {activeNav === "restaurants" && (
        <>
          {/* Hero greeting — GoFood style */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4"
          >
            <p className="text-sm text-muted-foreground">Selamat datang,</p>
            <h1 className="font-display text-2xl font-700 tracking-tight text-foreground">
              {user?.fullName?.split(" ")[0] ?? "Sobat Rejo"}! 👋
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Lagi lapar? Restoran terdekat menantimu.
            </p>
          </motion.div>

          {/* Category chips — horizontal scroll, GoFood style */}
          <div className="mb-5 -mx-4 px-4 overflow-x-auto scroll-slim">
            <div className="flex gap-2 pb-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.value;
                return (
                  <button
                    key={cat.value || "all"}
                    onClick={() => setActiveCategory(cat.value)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-700 transition-premium active:scale-95 ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section title */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-700 text-foreground">
              {activeCategory ? activeCategory : "Restoran terdekat"}
            </h2>
          </div>

          <RestaurantGrid key={activeCategory} cuisineFilter={activeCategory} />

          <div className="mb-6" />
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
