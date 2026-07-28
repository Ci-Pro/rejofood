"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, RefreshCw, Check, X, ChefHat, PackageCheck, Phone, MapPin, Clock, Wifi, WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOrderSocket } from "@/hooks/use-order-socket";

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
  customer: { id: string; name: string; phone: string | null };
  driver: { id: string; name: string } | null;
  items: OrderItem[];
  itemCount: number;
}

const STATUS_LABEL: Record<Order["status"], string> = {
  PENDING: "Menunggu",
  ACCEPTED: "Diterima",
  PREPARING: "Diproses",
  READY: "Siap dijemput",
  PICKED_UP: "Diantar",
  DELIVERED: "Selesai",
  CANCELLED: "Dibatalkan",
};

function statusBadgeClass(s: Order["status"]): string {
  if (s === "DELIVERED") return "bg-mint/15 text-mint border-mint/30";
  if (s === "CANCELLED") return "bg-rose/15 text-rose border-rose/30";
  if (s === "PENDING") return "bg-saffron/15 text-saffron border-saffron/30 animate-pulse";
  if (s === "READY" || s === "PICKED_UP") return "bg-lavender/15 text-lavender border-lavender/30";
  return "bg-muted text-muted-foreground border-border";
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  return `${hours} jam ${mins % 60} menit lalu`;
}

export function OrderQueue() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/merchant/orders?limit=30", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal memuat pesanan.");
        return;
      }
      setOrders(data.items);
      setError(null);
    } catch {
      setError("Koneksi bermasalah.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 🔔 Realtime: refetch saat event masuk
  const { isConnected: socketConnected } = useOrderSocket({
    onEvent: (event) => {
      if (event === "order:created" || event === "order:status") {
        fetchOrders();
      }
    },
  });

  useEffect(() => {
    fetchOrders();
    // Fallback polling — slower (30s) karena socket utama
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  async function updateStatus(orderId: string, status: string, reason?: string) {
    setUpdating(orderId);
    try {
      const res = await fetch(`/api/merchant/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Gagal update status.");
        return;
      }
      toast.success(`Order ${status === "ACCEPTED" ? "diterima" : status === "PREPARING" ? "mulai diproses" : status === "READY" ? "siap dijemput" : status === "CANCELLED" ? "ditolak" : "diperbarui"}.`);
      await fetchOrders();
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setUpdating(null);
    }
  }

  const pendingCount = orders.filter((o) => o.status === "PENDING").length;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="accent-lavender relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-role text-role-fg">
            <Bell className="h-4.5 w-4.5" strokeWidth={2.2} />
            {pendingCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose px-1 text-[0.6rem] font-700 text-rose-foreground">
                {pendingCount}
              </span>
            )}
          </span>
          <div>
            <h3 className="font-display text-lg font-700 text-foreground">Antrian pesanan</h3>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {socketConnected ? (
                <>
                  <Wifi className="h-3 w-3 text-mint" />
                  Real-time aktif · {orders.length} pesanan
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-muted-foreground" />
                  Fallback polling 30s · {orders.length} pesanan
                </>
              )}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading} className="h-8">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
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
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-muted/50" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-600 text-foreground">Belum ada pesanan</p>
          <p className="mt-1 text-xs text-muted-foreground">Pastikan restoran dalam status BUKA.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {orders.map((o) => (
              <motion.div
                key={o.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className={cn(
                  "rounded-xl border bg-background/60 p-3 transition-colors",
                  o.status === "PENDING" ? "border-saffron/40" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="font-display text-sm font-700 text-foreground">{o.code}</code>
                      <Badge variant="outline" className={cn("h-5 px-1.5 text-[0.6rem] font-700", statusBadgeClass(o.status))}>
                        {STATUS_LABEL[o.status]}
                      </Badge>
                      <span className="flex items-center gap-0.5 text-[0.65rem] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(o.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-600 text-foreground">{o.customer.name}</span>
                      {o.customer.phone && (
                        <span className="ml-2 flex items-center gap-0.5 inline-flex">
                          <Phone className="h-2.5 w-2.5" />
                          {o.customer.phone}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="font-display text-sm font-700 text-lavender">{formatRupiah(o.total)}</p>
                </div>

                {/* Items */}
                <div className="mt-2 space-y-0.5">
                  {o.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="text-foreground">
                        <span className="font-700 text-lavender">{item.quantity}×</span> {item.name}
                      </span>
                      <span className="text-muted-foreground">{formatRupiah(item.subtotal)}</span>
                    </div>
                  ))}
                </div>

                {/* Notes + address */}
                {(o.notes || o.deliveryAddress) && (
                  <div className="mt-2 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
                    {o.notes && <p className="italic">"{o.notes}"</p>}
                    <p className="flex items-start gap-1">
                      <MapPin className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                      {o.deliveryAddress}
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {o.status === "PENDING" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => updateStatus(o.id, "ACCEPTED")}
                        disabled={updating === o.id}
                        className="accent-lavender h-7 bg-role text-role-fg hover:opacity-90"
                      >
                        <Check className="h-3 w-3" /> Terima
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(o.id, "CANCELLED", "Ditolak merchant")}
                        disabled={updating === o.id}
                        className="h-7 text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3 w-3" /> Tolak
                      </Button>
                    </>
                  )}
                  {o.status === "ACCEPTED" && (
                    <Button
                      size="sm"
                      onClick={() => updateStatus(o.id, "PREPARING")}
                      disabled={updating === o.id}
                      className="accent-lavender h-7 bg-role text-role-fg hover:opacity-90"
                    >
                      <ChefHat className="h-3 w-3" /> Mulai proses
                    </Button>
                  )}
                  {o.status === "PREPARING" && (
                    <Button
                      size="sm"
                      onClick={() => updateStatus(o.id, "READY")}
                      disabled={updating === o.id}
                      className="accent-lavender h-7 bg-role text-role-fg hover:opacity-90"
                    >
                      <PackageCheck className="h-3 w-3" /> Siap dijemput
                    </Button>
                  )}
                  {o.status === "READY" && !o.driver && (
                    <p className="text-xs text-muted-foreground italic">Menunggu driver tersedia…</p>
                  )}
                  {o.status === "READY" && o.driver && (
                    <p className="text-xs text-lavender font-600">Driver: {o.driver.name} sedang menjemput</p>
                  )}
                  {o.status === "PICKED_UP" && o.driver && (
                    <p className="text-xs text-lavender font-600">Sedang diantar oleh {o.driver.name}</p>
                  )}
                  {o.status === "DELIVERED" && (
                    <p className="text-xs text-mint font-600">Selesai · {formatTime(o.deliveredAt ?? o.createdAt)}</p>
                  )}
                  {o.status === "CANCELLED" && (
                    <div className="text-xs">
                      <p className="font-600 text-rose">Dibatalkan</p>
                      {o.notes?.includes("[CANCELLED oleh customer:") && (
                        <p className="mt-0.5 text-muted-foreground italic">
                          "{o.notes.split("[CANCELLED oleh customer:")[1]?.replace("]", "")}"
                        </p>
                      )}
                      <p className="mt-0.5 text-muted-foreground">
                        Dibatalkan oleh customer · {formatTime(o.cancelledAt ?? o.createdAt)}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
