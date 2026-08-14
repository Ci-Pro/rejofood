"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, ShoppingBag, Clock, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface MerchantStats {
  today: { orders: number; revenue: number; active: number; pending: number };
  week: { orders: number; revenue: number };
  total: { orders: number; revenue: number };
}

function formatRupiah(n: number): string {
  if (n === 0) return "Rp 0";
  return "Rp " + n.toLocaleString("id-ID");
}

export function RevenueSummary() {
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/merchant/stats", { cache: "no-store" })
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
      value: formatRupiah(stats.today.revenue),
      hint: `${stats.today.orders} order selesai`,
      icon: Wallet,
      accent: "mint",
    },
    {
      label: "Order Aktif",
      value: stats.today.active,
      hint: `${stats.today.pending} menunggu accept`,
      icon: Clock,
      accent: "saffron",
    },
    {
      label: "Pendapatan 7 Hari",
      value: formatRupiah(stats.week.revenue),
      hint: `${stats.week.orders} order`,
      icon: TrendingUp,
      accent: "lavender",
    },
    {
      label: "Total Pendapatan",
      value: formatRupiah(stats.total.revenue),
      hint: `${stats.total.orders} order all-time`,
      icon: ShoppingBag,
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
