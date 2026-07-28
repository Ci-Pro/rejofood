"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";
import { Role } from "@/lib/auth/roles";
import { RoleRail } from "./role-rail";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
import { BrandLogo } from "./brand-logo";
import { cn } from "@/lib/utils";

/**
 * AuthShell — the unique asymmetric auth screen.
 *
 * Layout idea:
 *  - Desktop: 5/12 left "theatre" panel (deep aubergine, brand mark, role rail, value prop)
 *             7/12 right "stage" panel (warm ivory, glass form card)
 *  - Mobile:  vertical stack with brand strip on top, role chips, form below.
 *
 * This is deliberately NOT a centered card — most apps use that pattern.
 *
 * SECURITY: `showAdmin` mengontrol visibilitas role Admin di RoleRail.
 * Default false → Admin tidak terlihat. Set true hanya ketika user datang dari `/?admin=1`.
 */
export function AuthShell({ showAdmin = false }: { showAdmin?: boolean }) {
  const [role, setRole] = useState<Role>(Role.CUSTOMER);
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-12">
        {/* Left theatre panel (desktop only) */}
        <aside className="relative hidden overflow-hidden bg-primary lg:flex lg:col-span-5 xl:col-span-4">
          {/* Decorative warm gradient */}
          <div
            className="pointer-events-none absolute inset-0 opacity-95"
            style={{
              background:
                "radial-gradient(120% 80% at 0% 0%, oklch(0.38 0.10 296) 0%, oklch(0.26 0.10 296) 55%, oklch(0.20 0.06 296) 100%)",
            }}
            aria-hidden
          />
          {/* Saffron glow */}
          <div
            className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full opacity-40 blur-3xl"
            style={{ background: "oklch(0.78 0.16 68)" }}
            aria-hidden
          />
          <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-12">
            <BrandLogo size="lg" className="[&_p]:text-primary-foreground [&_.text-muted-foreground]:text-primary-foreground/60" />

            <div className="my-10">
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="font-display text-4xl font-700 leading-[1.1] text-primary-foreground xl:text-5xl"
              >
                Satu ekosistem,
                <br />
                <span className="text-saffron">empat peran,</span>
                <br />
                tanpa ribet.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mt-4 max-w-md text-sm leading-relaxed text-primary-foreground/70"
              >
                RejoFood menyatukan Pelanggan, Merchant, Driver, dan Admin dalam satu aplikasi
                yang ringan, terintegrasi, dan siap dipasang di Android.
              </motion.p>
            </div>

            <div>
              <RoleRail selected={role} onChange={setRole} showAdmin={showAdmin} />
              {showAdmin && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">
                  <Lock className="h-3.5 w-3.5" />
                  <span className="font-600">Area terbatas.</span>
                  <span className="text-rose/80">Akses admin terverifikasi 2 lapis.</span>
                </div>
              )}
              <p className="mt-5 text-xs text-primary-foreground/50">
                © {new Date().getFullYear()} RejoFood · v0.1 fondasi
              </p>
            </div>
          </div>
        </aside>

        {/* Right stage panel (always visible) */}
        <main className="relative flex min-h-screen flex-col bg-background bg-grain lg:col-span-7 xl:col-span-8">
          {/* Mobile brand strip */}
          <div className="flex items-center justify-between px-5 pt-6 pb-2 lg:hidden">
            <BrandLogo size="sm" />
          </div>

          {/* Mobile role rail (horizontal) */}
          <div className="px-5 py-3 lg:hidden">
            <RoleRail selected={role} onChange={setRole} showAdmin={showAdmin} />
            {showAdmin && (
              <div className={cn("mt-2 flex items-center gap-2 rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose")}>
                <Lock className="h-3.5 w-3.5" />
                <span className="font-600">Area terbatas.</span>
                <span className="text-rose/80">Akses admin terverifikasi 2 lapis.</span>
              </div>
            )}
          </div>

          <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
            <div className="glass-card relative w-full max-w-md rounded-3xl border border-border/80 p-6 shadow-2xl shadow-primary/5 sm:p-8">
              {/* Decorative corner accents */}
              <span className="pointer-events-none absolute -left-2 -top-2 h-6 w-6 rounded-tl-3xl border-l-2 border-t-2 border-role/40" aria-hidden />
              <span className="pointer-events-none absolute -bottom-2 -right-2 h-6 w-6 rounded-br-3xl border-b-2 border-r-2 border-role/40" aria-hidden />

              <AnimatePresence mode="wait">
                {mode === "login" ? (
                  <LoginForm key={`login-${role}`} role={role} onSwitchToRegister={() => setMode("register")} />
                ) : (
                  <RegisterForm key={`register-${role}`} role={role} onSwitchToLogin={() => setMode("login")} />
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
