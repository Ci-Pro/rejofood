"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Accent = "saffron" | "lavender" | "mint" | "rose";

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  delay = 0,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  accent: Accent;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "accent-" + accent,
        "group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition-premium hover:shadow-card-hover sm:p-5",
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
        <div className={cn("absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl bg-role-soft")} />
      </div>

      <div className="relative flex items-center justify-between">
        <span className="text-[0.6rem] font-700 uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-role-soft text-role transition-premium group-hover:scale-110">
          <Icon className="h-4 w-4" strokeWidth={2.3} />
        </span>
      </div>
      <p className="mt-3 font-display text-2xl font-700 tracking-tight text-foreground sm:text-3xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </motion.div>
  );
}

export function DashboardHeader({
  greeting,
  name,
  subtitle,
  accent,
}: {
  greeting: string;
  name?: string;
  subtitle?: string;
  accent: Accent;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn("accent-" + accent, "mb-4 sm:mb-5")}
    >
      <h1 className="font-display text-xl font-700 tracking-tight text-foreground sm:text-2xl">
        {greeting}
      </h1>
      {subtitle && (
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
      )}
    </motion.div>
  );
}

export function DashboardBanner({
  greeting,
  name,
  subtitle,
  accent,
  children,
}: {
  greeting: string;
  name?: string;
  subtitle?: string;
  accent: Accent;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "accent-" + accent,
        "relative mb-4 overflow-hidden rounded-2xl p-4 shadow-card sm:mb-5 sm:p-5",
      )}
    >
      {/* Gradient background — modern vivid role color */}
      <div
        className="pointer-events-none absolute inset-0 bg-role opacity-95"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(135deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.20) 100%)" }}
        aria-hidden
      />
      {/* Glow */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-15 blur-3xl"
        style={{ background: "var(--role)" }}
        aria-hidden
      />
      <div className="relative z-10 text-primary-foreground">
        <h1 className="font-display text-xl font-700 tracking-tight sm:text-2xl">
          {greeting}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-xs text-primary-foreground/70 sm:text-sm">{subtitle}</p>
        )}
        {children && <div className="mt-3">{children}</div>}
      </div>
    </motion.div>
  );
}
