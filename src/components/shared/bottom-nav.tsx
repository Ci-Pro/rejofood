"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { getNavItems } from "./nav-config";
import type { NavSection, NavAccent } from "./nav-types";

interface BottomNavProps {
  active: string;
  onChange: (key: string) => void;
  accent: NavAccent;
  badges?: Record<string, number>;
}

/**
 * Bottom navigation bar (mobile only — hidden on lg+).
 *
 * Native Android feel: fixed bottom, safe-area aware, premium glass effect.
 * Setiap tab: icon + label, active state dengan saffron/lavender/mint/rose tint.
 */
export function BottomNav({ active, onChange, accent, badges }: BottomNavProps) {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  const items = getNavItems(user.role, badges);

  return (
    <nav
      className={cn(
        "accent-" + accent,
        "fixed inset-x-0 bottom-0 z-40 lg:hidden bg-background/95 backdrop-blur-md border-t border-border",
        "pb-[env(safe-area-inset-bottom)]",
      )}
      aria-label="Navigasi utama"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-1">
        {items.map((item) => {
          const isActive = active === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2 transition-tap"
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
            >
              {/* Active indicator — top bar, modern native style */}
              {isActive && (
                <motion.span
                  layoutId="bottom-nav-active"
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-role"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className={cn(
                "relative flex h-7 w-7 items-center justify-center transition-premium",
              )}>
                <Icon
                  className={cn("h-5 w-5 transition-premium", isActive ? "text-role" : "text-muted-foreground")}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -right-1.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose px-1 text-[0.55rem] font-700 text-rose-foreground">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </span>
              <span className={cn(
                "max-w-full truncate text-[0.625rem] font-600 transition-premium",
                isActive ? "text-role" : "text-muted-foreground",
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export type { NavSection, NavAccent };
