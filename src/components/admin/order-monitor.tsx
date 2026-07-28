"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ScrollText, RefreshCw, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AdminOrder {
  id: string;
  code: string;
  status: "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "PICKED_UP" | "DELIVERED" | "CANCELLED";
  total: number;
  subtotal: number;
  deliveryFee: number;
  createdAt: string;
  deliveredAt: string | null;
  customerName: string;
  merchantName: string;
  driverName: string | null;
  itemCount: number;
}

const STATUS_LABEL: Record<AdminOrder["status"], string> = {
  PENDING: "Menunggu",
  ACCEPTED: "Diterima",
  PREPARING: "Diproses",
  READY: "Siap",
  PICKED_UP: "Diantar",
  DELIVERED: "Selesai",
  CANCELLED: "Batal",
};

function statusBadgeClass(s: AdminOrder["status"]): string {
  if (s === "DELIVERED") return "bg-mint/15 text-mint border-mint/30";
  if (s === "CANCELLED") return "bg-rose/15 text-rose border-rose/30";
  if (s === "PENDING") return "bg-saffron/15 text-saffron border-saffron/30";
  if (s === "READY" || s === "PICKED_UP") return "bg-lavender/15 text-lavender border-lavender/30";
  return "bg-muted text-muted-foreground border-border";
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function OrderMonitor() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`/api/admin/orders?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal memuat orders.");
        return;
      }
      setOrders(data.items);
      setTotal(data.total);
    } catch {
      setError("Koneksi bermasalah.");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  return (
    <section className="accent-rose rounded-2xl border border-border bg-card p-5 sm:p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-role text-role-fg">
            <ScrollText className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
          <div>
            <h3 className="font-display text-lg font-700 text-foreground">Monitor pesanan</h3>
            <p className="text-xs text-muted-foreground">{total} total · {orders.length} ditampilkan</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOrders}
          disabled={loading}
          className="h-8"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </header>

      {/* Filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {["", "PENDING", "ACCEPTED", "PREPARING", "READY", "PICKED_UP", "DELIVERED", "CANCELLED"].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setFilterStatus(s)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[0.65rem] font-700 uppercase transition-colors",
              filterStatus === s
                ? "accent-rose border-role bg-role-soft text-role"
                : "border-border bg-card text-muted-foreground hover:border-role/40",
            )}
          >
            {s ? STATUS_LABEL[s as AdminOrder["status"]] : "Semua"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-rose/30 bg-rose/5 p-3 text-sm text-rose">
          {error}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-muted/50" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <ScrollText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-600 text-foreground">Tidak ada pesanan</p>
        </div>
      ) : (
        <div className="max-h-[28rem] space-y-1.5 overflow-y-auto scroll-slim pr-1">
          {orders.map((o, idx) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="font-display text-xs font-700 text-foreground">{o.code}</code>
                  <Badge variant="outline" className={cn("h-4 px-1.5 text-[0.55rem] font-700", statusBadgeClass(o.status))}>
                    {STATUS_LABEL[o.status]}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  <span className="font-600 text-foreground">{o.customerName}</span>
                  {" → "}
                  <span className="text-foreground">{o.merchantName}</span>
                  {o.driverName && (
                    <>
                      {" · "}
                      <span className="text-mint">{o.driverName}</span>
                    </>
                  )}
                </p>
                <p className="text-[0.65rem] text-muted-foreground/80">
                  {o.itemCount} item · {formatTime(o.createdAt)}
                </p>
              </div>
              <p className="font-display text-sm font-700 text-rose">{formatRupiah(o.total)}</p>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
