"use client";

import { motion } from "framer-motion";
import { LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/auth/brand-logo";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import { getNavItems } from "./nav-config";
import type { NavSection, NavAccent } from "./nav-types";

interface SideNavProps {
  active: string;
  onChange: (key: string) => void;
  accent: NavAccent;
  badges?: Record<string, number>;
}

/**
 * Side navigation (desktop only — hidden on < lg).
 * Fixed left, premium feel dengan logo + nav items + user menu di bawah.
 */
export function SideNav({ active, onChange, accent, badges }: SideNavProps) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const items = getNavItems(user.role, badges);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    toast.success("Berhasil keluar. Sampai jumpa!");
  }

  return (
    <aside className={cn(
      "accent-" + accent,
      "fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex",
    )}>
      {/* Logo */}
      <div className="border-b border-sidebar-border px-6 py-5">
        <BrandLogo size="md" variant="compact" />
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1 overflow-y-auto scroll-slim p-3" aria-label="Navigasi utama">
        {items.map((item) => {
          const isActive = active === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-premium",
                isActive
                  ? "bg-role-soft text-role font-700"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={cn(
                "flex h-5 w-5 items-center justify-center transition-premium",
                isActive ? "text-role" : "text-muted-foreground group-hover:text-foreground",
              )}>
                <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={isActive ? 2.4 : 2} />
              </span>
              <span className="flex-1 text-sm">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose px-1.5 text-[0.6rem] font-700 text-rose-foreground">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
              {isActive && (
                <motion.span
                  layoutId="sidenav-active"
                  className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-role"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* User menu */}
      <div className="border-t border-sidebar-border p-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((s) => !s)}
            className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-sidebar-accent transition-premium"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-role text-role-fg text-sm font-700")}>
              {user.fullName[0]?.toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-700 text-sidebar-foreground">{user.fullName}</p>
              <p className="truncate text-[0.65rem] text-muted-foreground">{user.email}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Tutup menu"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-14 left-0 right-0 z-50 overflow-hidden rounded-2xl border border-border bg-popover shadow-premium"
              >
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-600 text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar
                </button>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

export type { NavSection, NavAccent };
