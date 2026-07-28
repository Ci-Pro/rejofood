"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, ChevronDown, CircleUser } from "lucide-react";
import { BrandLogo } from "@/components/auth/brand-logo";
import { ROLES } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import { SessionCountdown } from "./session-countdown";
import { BottomNav } from "./bottom-nav";
import { SideNav } from "./side-nav";
import type { NavAccent } from "./nav-types";

interface AppShellProps {
  children: React.ReactNode;
  accent: NavAccent;
  activeNav: string;
  onNavChange: (key: string) => void;
  navBadges?: Record<string, number>;
}

/**
 * AppShell v2.0 — premium layout dengan:
 *  - Desktop (lg+): sidebar kiri (SideNav) + content kanan
 *  - Mobile (< lg): header atas + content + bottom nav
 *  - Sticky header dengan brand + role badge + session countdown (admin) + user menu
 */
export function AppShell({
  children,
  accent,
  activeNav,
  onNavChange,
  navBadges,
}: AppShellProps) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    toast.success("Berhasil keluar. Sampai jumpa!");
    setMenuOpen(false);
  }

  const meta = user ? ROLES[user.role] : null;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <SideNav
        active={activeNav}
        onChange={onNavChange}
        accent={accent}
        badges={navBadges}
      />

      {/* Main content area */}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        {/* Top header */}
        <header className={cn(
          "accent-" + accent,
          "sticky top-0 z-30 glass-header border-b border-border/60",
        )}>
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              {/* Mobile: show compact logo (sidebar hidden) */}
              <div className="lg:hidden">
                <BrandLogo size="sm" variant="compact" />
              </div>
              {/* Desktop: role badge only (logo in sidebar) */}
              <span className="hidden h-6 w-px bg-border lg:block" />
              <span className={cn(
                "hidden items-center gap-1.5 rounded-full bg-role-soft px-3 py-1 text-xs font-700 text-role lg:inline-flex",
              )}>
                {meta && <meta.icon className="h-3.5 w-3.5" strokeWidth={2.4} />}
                {meta?.label}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <SessionCountdown />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((s) => !s)}
                  className="flex items-center gap-2 rounded-full border border-border bg-card pl-2.5 pr-3 py-1.5 text-sm hover:border-role/40 transition-premium shadow-premium"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-role text-role-fg text-xs font-700">
                    {user?.fullName?.[0]?.toUpperCase() ?? <CircleUser className="h-4 w-4" />}
                  </span>
                  <span className="hidden max-w-[140px] truncate font-600 sm:block">
                    {user?.fullName}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <>
                      <button
                        type="button"
                        aria-label="Tutup menu"
                        className="fixed inset-0 z-40 cursor-default"
                        onClick={() => setMenuOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-premium-lg"
                      >
                        <div className="px-3 py-2.5">
                          <p className="truncate text-sm font-700">{user?.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                        </div>
                        <div className="my-1 h-px bg-border" />
                        <button
                          type="button"
                          onClick={logout}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-600 text-destructive hover:bg-destructive/10"
                        >
                          <LogOut className="h-4 w-4" />
                          Keluar
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:px-8 lg:pb-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>

        {/* Footer (desktop only — bottom nav replaces it on mobile) */}
        <footer className="hidden border-t border-border/60 bg-background/60 py-4 lg:block">
          <div className="mx-auto max-w-6xl px-8 text-xs text-muted-foreground">
            RejoFood · fondasi v2.0 · <span className="text-foreground/70">Built for Android-ready PWA</span>
          </div>
        </footer>
      </div>

      {/* Bottom nav (mobile only) */}
      <BottomNav
        active={activeNav}
        onChange={onNavChange}
        accent={accent}
        badges={navBadges}
      />
    </div>
  );
}
