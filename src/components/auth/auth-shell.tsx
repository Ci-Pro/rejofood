"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, UtensilsCrossed, Store, Bike } from "lucide-react";
import { Role } from "@/lib/auth/roles";
import { RoleRail } from "./role-rail";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
import { BrandLogo } from "./brand-logo";
import { cn } from "@/lib/utils";

/**
 * AuthShell v3.0 — premium centered layout.
 *
 * Single column, full-screen gradient with floating glass card.
 * Animated background blobs (saffron + lavender) for depth.
 * Role badge shown when locked (separate APKs).
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

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Animated background blobs */}
      <div className="pointer-events-none fixed inset-0">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-20 top-1/4 h-72 w-72 rounded-full opacity-20 blur-3xl"
          style={{ background: "#7C5BBF" }}
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-20 bottom-1/4 h-80 w-80 rounded-full opacity-15 blur-3xl"
          style={{ background: "#FF9F1C" }}
        />
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, -30, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full opacity-10 blur-3xl"
          style={{ background: "#2D1B4E" }}
        />
      </div>

      {/* Centered content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-8">
        {/* Brand logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <BrandLogo size="lg" />
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6 max-w-md text-center text-sm text-muted-foreground"
        >
          {isLockedRole ? (
            role === Role.CUSTOMER ? "Pesan makanan favoritmu, antar sampai depan pintu."
            : role === Role.MERCHANT ? "Kelola restoran & pesanan masuk dengan mudah."
            : role === Role.DRIVER ? "Antar pesanan, dapatkan penghasilan harian."
            : "Panel kontrol admin RejoFood."
          ) : (
            "Satu ekosistem, empat peran — tanpa ribet."
          )}
        </motion.p>

        {/* Role rail (if not locked) */}
        {!isLockedRole && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6 w-full max-w-md"
          >
            <RoleRail selected={role} onChange={setRole} showAdmin={showAdmin} />
            {showAdmin && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">
                <Lock className="h-3.5 w-3.5" />
                <span className="font-600">Area terbatas.</span>
                <span className="text-rose/80">Akses admin terverifikasi 2 lapis.</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Locked role badge */}
        {isLockedRole && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6 flex items-center gap-2.5 rounded-2xl border border-border bg-card/60 px-4 py-2.5 backdrop-blur-sm"
          >
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
          </motion.div>
        )}

        {/* Glass form card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card w-full max-w-md rounded-3xl border border-border/60 p-6 shadow-premium-lg sm:p-8"
        >
          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <LoginForm key={`login-${role}`} role={role} onSwitchToRegister={() => setMode("register")} />
            ) : (
              <RegisterForm key={`register-${role}`} role={role} onSwitchToLogin={() => setMode("login")} />
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer */}
        <p className="mt-6 text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} RejoFood · v3.0
        </p>
      </div>
    </div>
  );
}
