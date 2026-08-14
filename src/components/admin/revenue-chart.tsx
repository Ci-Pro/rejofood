"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, ShoppingBag, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayData {
  date: string;
  label: string;
  revenue: number;
  orders: number;
}

interface ChartData {
  days: DayData[];
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
}

function formatRupiah(n: number): string {
  if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + "jt";
  if (n >= 1_000) return "Rp " + (n / 1_000).toFixed(0) + "rb";
  return "Rp " + n.toLocaleString("id-ID");
}

export function RevenueChart() {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"revenue" | "orders">("revenue");

  async function load(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/admin/revenue-chart", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.days.length === 0) return null;

  const values = data.days.map((d) => (view === "revenue" ? d.revenue : d.orders));
  const maxVal = Math.max(...values, 1);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-700 text-foreground">Revenue 7 Hari</h3>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-primary" />
              <span className="font-700 text-foreground">{formatRupiah(data.totalRevenue)}</span>
              total
            </span>
            <span className="flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" />
              <span className="font-700 text-foreground">{data.totalOrders}</span>
              order
            </span>
            <span>AOV: <span className="font-700 text-foreground">{formatRupiah(data.avgOrderValue)}</span></span>
          </div>
        </div>
        <div className="flex gap-1">
          <div className="flex rounded-lg border border-border bg-background p-0.5">
            <button
              onClick={() => setView("revenue")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[0.65rem] font-700 transition-premium",
                view === "revenue" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              Revenue
            </button>
            <button
              onClick={() => setView("orders")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[0.65rem] font-700 transition-premium",
                view === "orders" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              Order
            </button>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Bar chart */}
      <div className="mt-5 flex items-end justify-between gap-2" style={{ height: "140px" }}>
        {data.days.map((day, idx) => {
          const val = view === "revenue" ? day.revenue : day.orders;
          const heightPct = (val / maxVal) * 100;
          const isToday = idx === data.days.length - 1;
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
              {/* Value label (show if > 0) */}
              <span className="text-[0.6rem] font-700 text-muted-foreground tabular-nums">
                {val > 0 ? (view === "revenue" ? formatRupiah(val) : val) : ""}
              </span>
              {/* Bar */}
              <div className="flex w-full flex-1 items-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPct}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.05, ease: "easeOut" }}
                  className={cn(
                    "w-full rounded-t-lg transition-premium",
                    isToday ? "bg-primary" : "bg-primary/40",
                  )}
                  style={{ minHeight: val > 0 ? "4px" : "0" }}
                />
              </div>
              {/* Day label */}
              <span className={cn(
                "text-[0.6rem] font-600",
                isToday ? "text-primary" : "text-muted-foreground",
              )}>
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
