"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, RefreshCw, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface Order {
  id: string;
  code: string;
  status: "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "PICKED_UP" | "DELIVERED" | "CANCELLED";
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryAddress: string;
  notes: string | null;
  createdAt: string;
  acceptedAt: string | null;
  readyAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  merchant: { id: string; restaurantName: string; address: string };
  driver: { id: string; name: string } | null;
  items: OrderItem[];
  itemCount: number;
}

const STATUS_FLOW: Order["status"][] = ["PENDING", "ACCEPTED", "PREPARING", "READY", "PICKED_UP", "DELIVERED"];

function statusLabel(s: Order["status"]): string {
  const map: Record<string, string> = {
    PENDING: "Menunggu",
    ACCEPTED: "Diterima",
    PREPARING: "Diproses",
    READY: "Siap dijemput",
    PICKED_UP: "Diantar",
    DELIVERED: "Selesai",
    CANCELLED: "Dibatalkan",
  };
  return map[s] ?? s;
}

function statusBadgeClass(s: Order["status"]): string {
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

export function MyOrdersList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders?limit=20", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal memuat pesanan.");
        return;
      }
      setOrders(data.items);
    } catch {
      setError("Koneksi bermasalah.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    // Poll setiap 10 detik untuk update status real-time
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="accent-saffron flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-role text-role-fg">
            <Package className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
          <div>
            <h3 className="font-display text-lg font-700 text-foreground">Pesanan saya</h3>
            <p className="text-xs text-muted-foreground">{orders.length} pesanan · auto-refresh 10s</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading} className="h-8">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </header>

      {error && (
        <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-muted/50" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-600 text-foreground">Belum ada pesanan</p>
          <p className="mt-1 text-xs text-muted-foreground">Pesan dari restoran untuk mulai.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o, idx) => (
            <motion.button
              key={o.id}
              type="button"
              onClick={() => setSelected(o)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="accent-saffron flex w-full items-center gap-3 rounded-xl border border-border bg-background/60 p-3 text-left hover:border-role/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-700 text-foreground">{o.code}</code>
                  <Badge variant="outline" className={cn("h-4 px-1.5 text-[0.6rem] font-700", statusBadgeClass(o.status))}>
                    {statusLabel(o.status)}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-sm font-600 text-foreground">{o.merchant.restaurantName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {o.itemCount} item · {formatTime(o.createdAt)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-sm font-700 text-saffron">{formatRupiah(o.total)}</p>
                <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.button
              type="button"
              aria-label="Tutup detail"
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
              onClick={() => setSelected(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              <div className="flex items-center justify-between border-b border-border bg-card p-4">
                <div>
                  <h2 className="font-display text-lg font-700 text-foreground">{selected.code}</h2>
                  <p className="text-xs text-muted-foreground">{selected.merchant.restaurantName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"
                  aria-label="Tutup"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto scroll-slim p-4">
                {/* Status timeline */}
                <div className="mb-4">
                  <Badge variant="outline" className={cn("h-6 px-2 text-xs font-700", statusBadgeClass(selected.status))}>
                    {statusLabel(selected.status)}
                  </Badge>
                  {selected.status !== "CANCELLED" && (
                    <div className="mt-3 flex items-center">
                      {STATUS_FLOW.map((s, i) => {
                        const currentIdx = STATUS_FLOW.indexOf(selected.status);
                        const done = i <= currentIdx;
                        return (
                          <div key={s} className="flex flex-1 items-center">
                            <div className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-700",
                              done ? "bg-saffron text-saffron-foreground" : "bg-muted text-muted-foreground",
                            )}>
                              {i + 1}
                            </div>
                            {i < STATUS_FLOW.length - 1 && (
                              <div className={cn("h-0.5 flex-1", i < currentIdx ? "bg-saffron" : "bg-muted")} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-1.5 flex justify-between text-[0.6rem] text-muted-foreground">
                    {["Order", "Diterima", "Diproses", "Siap", "Diantar", "Sampai"].map((label) => (
                      <span key={label} className="flex-1 text-center">{label}</span>
                    ))}
                  </div>
                </div>

                {/* Items */}
                <div className="mb-4">
                  <h4 className="mb-2 text-xs font-700 uppercase tracking-wide text-muted-foreground">Item</h4>
                  <div className="space-y-1.5">
                    {selected.items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between rounded-lg border border-border bg-card p-2.5 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-saffron/15 text-xs font-700 text-saffron">
                            {item.quantity}×
                          </span>
                          <div>
                            <p className="font-600 text-foreground">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{formatRupiah(item.price)}</p>
                          </div>
                        </div>
                        <p className="font-700 text-foreground">{formatRupiah(item.subtotal)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery info */}
                <div className="mb-4 space-y-2 text-xs">
                  <div>
                    <p className="font-700 uppercase tracking-wide text-muted-foreground">Alamat pengantaran</p>
                    <p className="mt-0.5 text-foreground">{selected.deliveryAddress}</p>
                  </div>
                  {selected.notes && (
                    <div>
                      <p className="font-700 uppercase tracking-wide text-muted-foreground">Catatan</p>
                      <p className="mt-0.5 text-foreground">{selected.notes}</p>
                    </div>
                  )}
                  {selected.driver && (
                    <div>
                      <p className="font-700 uppercase tracking-wide text-muted-foreground">Driver</p>
                      <p className="mt-0.5 text-foreground">{selected.driver.name}</p>
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div className="space-y-1 rounded-xl border border-border bg-card p-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatRupiah(selected.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Ongkos antar</span>
                    <span className="tabular-nums">{formatRupiah(selected.deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1 font-700 text-foreground">
                    <span>Total</span>
                    <span className="font-display tabular-nums">{formatRupiah(selected.total)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}
