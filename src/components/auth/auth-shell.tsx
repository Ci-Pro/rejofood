"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, UtensilsCrossed, Store, Bike } from "lucide-react";
import { Role } from "@/lib/auth/roles";
import { RoleRail } from "./role-rail";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
import { BrandLogo } from "./brand-logo";
import { cn } from "@/lib/utils";

/**
 * AuthShell v3.2 — performance optimized.
 *
 * Optimization:
 *  - Animated blobs diganti dengan CSS-only static gradient (no JS animation loop)
 *  - Motion animation reduced: hanya initial fade-in, no infinite loops
 *  - Defer motion untuk non-critical elements
 *
 * Lock behavior tetap sama:
 *  - Jika appRole diset (APK), role TIDAK BISA diubah
 *  - RoleRail disembunyikan, hanya role badge yang tampil
 */
export function AuthShell({ showAdmin = false, appRole = null }: { showAdmin?: boolean; appRole?: string | null }) {
  const initialRole = appRole === "CUSTOMER" ? Role.CUSTOMER
    : appRole === "MERCHANT" ? Role.MERCHANT
    : appRole === "DRIVER" ? Role.DRIVER
    : appRole === "ADMIN" ? Role.ADMIN
    : Role.CUSTOMER;

  const [role, setRole] = useState<Role>(initialRole);
  const [mode, setMode] = useState<"login" | "register">("login");
  const isLockedRole = !!appRole;

  useEffect(() => {
    if (appRole === "CUSTOMER") setRole(Role.CUSTOMER);
    else if (appRole === "MERCHANT") setRole(Role.MERCHANT);
    else if (appRole === "DRIVER") setRole(Role.DRIVER);
  }, [appRole]);

  const safeSetRole = isLockedRole ? () => {} : setRole;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Modern clean background — subtle gradient, no blobs */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "linear-gradient(180deg, #FFFFFF 0%, #F8F9FB 100%)",
        }}
      />

      {/* Centered content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-8">
        {/* Brand logo — instant render */}
        <div className="mb-6">
          <BrandLogo size="lg" />
        </div>

        {/* Tagline */}
        <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">
          {isLockedRole ? (
            role === Role.CUSTOMER ? "Pesan makanan favoritmu, antar sampai depan pintu."
            : role === Role.MERCHANT ? "Kelola restoran & pesanan masuk dengan mudah."
            : role === Role.DRIVER ? "Antar pesanan, dapatkan penghasilan harian."
            : "Panel kontrol admin RejoFood."
          ) : (
            "Satu ekosistem, empat peran — tanpa ribet."
          )}
        </p>

        {/* Role rail (if not locked) */}
        {!isLockedRole && (
          <div className="mb-5 w-full max-w-md">
            <RoleRail selected={role} onChange={safeSetRole} showAdmin={showAdmin} />
            {showAdmin && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">
                <Lock className="h-3.5 w-3.5" />
                <span className="font-600">Area terbatas.</span>
                <span className="text-rose/80">Akses admin terverifikasi 2 lapis.</span>
              </div>
            )}
          </div>
        )}

        {/* Locked role badge */}
        {isLockedRole && (
          <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-border bg-card/60 px-4 py-2.5 backdrop-blur-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              {role === Role.CUSTOMER && <UtensilsCrossed className="h-4 w-4" />}
              {role === Role.MERCHANT && <Store className="h-4 w-4" />}
              {role === Role.DRIVER && <Bike className="h-4 w-4" />}
            </span>
            <div>
              <p className="text-sm font-700 text-foreground">
                {role === Role.CUSTOMER && "RejoFood Customer"}
                {role === Role.MERCHANT && "RejoFood Merchant"}
                {role === Role.DRIVER && "RejoFood Driver"}
              </p>
              <p className="text-[0.65rem] text-muted-foreground">
                {role === Role.CUSTOMER && "Pesan makanan favoritmu"}
                {role === Role.MERCHANT && "Kelola restoran & pesanan"}
                {role === Role.DRIVER && "Antar pesanan dengan cepat"}
              </p>
            </div>
          </div>
        )}

        {/* Form card — modern clean white card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-premium sm:p-8"
        >
          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <LoginForm
                key={`login-${role}`}
                role={role}
                onSwitchToRegister={() => setMode("register")}
                isLockedRole={isLockedRole}
              />
            ) : (
              <RegisterForm key={`register-${role}`} role={role} onSwitchToLogin={() => setMode("login")} />
            )}
          </AnimatePresence>
        </motion.div>

        <p className="mt-6 text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} RejoFood · v3.0
        </p>
      </div>
    </div>
  );
}
