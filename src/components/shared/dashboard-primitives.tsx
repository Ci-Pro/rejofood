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
      transition={{ duration: 0.3, delay, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "accent-" + accent,
        "group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-premium hover:shadow-card-hover sm:p-5",
      )}
    >
      <div className="relative flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-2xl font-700 tracking-tight text-foreground sm:text-3xl">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-role-soft text-role transition-premium group-hover:scale-105">
          <Icon className="h-5 w-5" strokeWidth={2.3} />
        </span>
      </div>
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
      {/* Gradient background — RejoFood teal */}
      <div
        className="pointer-events-none absolute inset-0 bg-role"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(135deg, rgba(255,107,34,0.12) 0%, rgba(0,0,0,0.15) 100%)" }}
        aria-hidden
      />
      {/* Orange accent glow */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-3xl"
        style={{ background: "#FF6B22" }}
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
