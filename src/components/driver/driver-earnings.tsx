"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, Bike, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface DriverStats {
  today: { deliveries: number; earnings: number };
  week: { deliveries: number; earnings: number };
  total: { deliveries: number; earnings: number; rating: number };
  active: number;
}

function formatRupiah(n: number): string {
  if (n === 0) return "Rp 0";
  return "Rp " + n.toLocaleString("id-ID");
}

export function DriverEarnings() {
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/driver/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.today) setStats(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/50" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      label: "Pendapatan Hari Ini",
      value: formatRupiah(stats.today.earnings),
      hint: `${stats.today.deliveries} pengiriman`,
      icon: Wallet,
      accent: "mint",
    },
    {
      label: "Sedang Mengantar",
      value: stats.active,
      hint: "Pengiriman aktif",
      icon: Bike,
      accent: "saffron",
    },
    {
      label: "Pendapatan 7 Hari",
      value: formatRupiah(stats.week.earnings),
      hint: `${stats.week.deliveries} pengiriman`,
      icon: TrendingUp,
      accent: "lavender",
    },
    {
      label: "Total Pendapatan",
      value: formatRupiah(stats.total.earnings),
      hint: `${stats.total.deliveries} pengiriman · ★ ${stats.total.rating.toFixed(1)}`,
      icon: Star,
      accent: "rose",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className={cn(
              "accent-" + card.accent,
              "group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-premium hover:shadow-card-hover",
            )}
          >
            <div className="relative flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-2 font-display text-xl font-700 tracking-tight text-foreground sm:text-2xl">
                  {card.value}
                </p>
                {card.hint && <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{card.hint}</p>}
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-role-soft text-role transition-premium group-hover:scale-105">
                <Icon className="h-4 w-4" strokeWidth={2.3} />
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
