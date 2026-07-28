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
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={cn(
        "accent-" + accent,
        "group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-premium transition-premium hover:shadow-premium-lg sm:p-5",
      )}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-role-soft blur-2xl" />
      </div>

      <div className="relative flex items-center justify-between">
        <span className="text-[0.65rem] font-700 uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-role-soft text-role transition-premium group-hover:scale-110">
          <Icon className="h-4 w-4" strokeWidth={2.3} />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-700 tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </motion.div>
  );
}

export function PlaceholderSection({
  title,
  description,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: Accent;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "accent-" + accent,
        "rounded-2xl border border-dashed border-role/40 bg-role-soft/30 p-5 sm:p-6 shadow-premium",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-role text-role-fg shadow-glow-primary">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-lg font-700 text-foreground">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
          {children}
        </div>
      </div>
    </section>
  );
}

export function DashboardHeader({
  greeting,
  name,
  subtitle,
  accent,
}: {
  greeting: string;
  name: string;
  subtitle: string;
  accent: Accent;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn("accent-" + accent, "mb-6")}
    >
      <p className="text-[0.7rem] font-700 uppercase tracking-[0.2em] text-role">{greeting}</p>
      <h1 className="mt-1.5 font-display text-2xl font-700 tracking-tight text-foreground sm:text-3xl">
        Halo, <span className="text-gradient-primary">{name}!</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </motion.div>
  );
}
