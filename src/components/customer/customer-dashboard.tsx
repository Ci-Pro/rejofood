"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { UtensilsCrossed, Coffee, Pizza, Soup, Cake, Fish, Wheat, Sparkles } from "lucide-react";

const PROMO_BANNERS = [
  {
    title: "Diskon 10%",
    subtitle: "Pesanan pertama kamu",
    code: "REJO10",
    gradient: "linear-gradient(135deg, #003F3F 0%, #1A5757 100%)",
  },
  {
    title: "Gratis Ongkir",
    subtitle: "Min. belanja Rp 30.000",
    code: "GRATISONGKIR",
    gradient: "linear-gradient(135deg, #1A5757 0%, #2F8F6B 100%)",
  },
  {
    title: "Hemat 25%",
    subtitle: "Maks. Rp 50.000",
    code: "REJOFOOD25",
    gradient: "linear-gradient(135deg, #003F3F 0%, #FF6B22 100%)",
  },
];

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
  const [bannerIdx, setBannerIdx] = useState(0);

  // Auto-rotate promo banner setiap 4 detik
  useEffect(() => {
    if (activeNav !== "restaurants") return;
    const t = setInterval(() => {
      setBannerIdx((prev) => (prev + 1) % PROMO_BANNERS.length);
    }, 4000);
    return () => clearInterval(t);
  }, [activeNav]);

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

          {/* Promo banner carousel — auto-rotate */}
          <div className="mb-5 overflow-hidden rounded-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={bannerIdx}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.4 }}
                className="relative flex items-center justify-between p-4 text-white"
                style={{ background: PROMO_BANNERS[bannerIdx].gradient }}
              >
                <div className="relative z-10">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="text-[0.65rem] font-700 uppercase tracking-wider opacity-90">
                      Promo
                    </span>
                  </div>
                  <p className="mt-1 font-display text-lg font-700">
                    {PROMO_BANNERS[bannerIdx].title}
                  </p>
                  <p className="text-xs opacity-90">
                    {PROMO_BANNERS[bannerIdx].subtitle}
                  </p>
                  <div className="mt-2 inline-flex items-center rounded-full bg-white/20 px-2.5 py-1 text-xs font-700 backdrop-blur">
                    Kode: {PROMO_BANNERS[bannerIdx].code}
                  </div>
                </div>
                {/* Dots indicator */}
                <div className="absolute bottom-2 right-3 flex gap-1">
                  {PROMO_BANNERS.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === bannerIdx ? "w-4 bg-white" : "w-1.5 bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

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
                        : "border-border bg-card text-secondary-foreground hover:border-primary/30"
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
