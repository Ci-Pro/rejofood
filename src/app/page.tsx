"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AuthShell } from "@/components/auth/auth-shell";
import { CustomerDashboard } from "@/components/customer/customer-dashboard";
import { MerchantDashboard } from "@/components/merchant/merchant-dashboard";
import { DriverDashboard } from "@/components/driver/driver-dashboard";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { useAuthStore } from "@/store/auth-store";
import { Role } from "@/lib/auth/roles";
import { BrandLogo } from "@/components/auth/brand-logo";

type View = "loading" | "auth" | "customer" | "merchant" | "driver" | "admin";

function viewForRole(role: Role): Exclude<View, "loading" | "auth"> {
  switch (role) {
    case Role.CUSTOMER: return "customer";
    case Role.MERCHANT: return "merchant";
    case Role.DRIVER: return "driver";
    case Role.ADMIN: return "admin";
  }
}

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  // `booted` flips true once the initial session check has resolved.
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (data?.user) setUser(data.user);
      } catch {
        // network errors → just show auth screen
      } finally {
        if (!cancelled) setBooted(true);
      }
    })();
    return () => { cancelled = true; };
  }, [setUser]);

  // Derive view directly from state — no chained effects, no cascading renders.
  const view: View = !booted
    ? "loading"
    : user
      ? viewForRole(user.role as Role)
      : "auth";

  if (view === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <BrandLogo size="md" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Memuat RejoFood…
        </motion.div>
      </div>
    );
  }

  if (view === "auth") return <AuthShell />;
  if (view === "customer") return <CustomerDashboard />;
  if (view === "merchant") return <MerchantDashboard />;
  if (view === "driver") return <DriverDashboard />;
  if (view === "admin") return <AdminDashboard />;
  return <AuthShell />;
}
