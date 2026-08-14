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
            transition={{ duration: 0.4, delay: idx * 0.05 }}
            className={cn(
              "accent-" + card.accent,
              "rounded-2xl border border-border bg-card p-3.5 shadow-card",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[0.6rem] font-700 uppercase tracking-wider text-muted-foreground">
                {card.label}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-role-soft text-role">
                <Icon className="h-3.5 w-3.5" strokeWidth={2.3} />
              </span>
            </div>
            <p className="mt-2 font-display text-lg font-700 tracking-tight text-foreground sm:text-xl">
              {card.value}
            </p>
            <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{card.hint}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
