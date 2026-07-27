"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

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
  accent: "saffron" | "lavender" | "mint" | "rose";
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={cn(
        "accent-" + accent,
        "relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-role-soft text-role">
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-700 text-foreground">{value}</p>
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
  accent: "saffron" | "lavender" | "mint" | "rose";
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "accent-" + accent,
        "rounded-2xl border border-dashed border-role/40 bg-role-soft/40 p-5 sm:p-6",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-role text-role-fg">
          <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-lg font-700 text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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
  accent: "saffron" | "lavender" | "mint" | "rose";
}) {
  return (
    <div className={cn("accent-" + accent, "mb-6")}>
      <p className="text-xs font-600 uppercase tracking-[0.18em] text-role">{greeting}</p>
      <h1 className="mt-1 font-display text-2xl font-700 leading-tight text-foreground sm:text-3xl">
        Halo, {name}!
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
