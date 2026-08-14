"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, RefreshCw, MapPin, Store, User, Phone, CheckCircle2, Bike, Wifi, WifiOff,
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
  status: "READY" | "PICKED_UP";
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryAddress: string;
  notes: string | null;
  createdAt: string;
  readyAt: string | null;
  pickedUpAt: string | null;
  merchant: { id: string; restaurantName: string; address: string };
  customer: { id: string; name: string; phone: string | null };
  items: OrderItem[];
  itemCount: number;
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  return `${Math.floor(mins / 60)} jam ${mins % 60} menit lalu`;
}

export function DriverOrders() {
  const [available, setAvailable] = useState<Order[]>([]);
  const [active, setActive] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);

  // Fetch driver online status
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        const data = await res.json();
        if (data.isOnline !== undefined) setIsOnline(data.isOnline);
      } catch { /* silent */ }
    })();
  }, []);

  async function toggleOnline() {
    const newValue = !isOnline;
    setIsOnline(newValue); // optimistic
    try {
      const res = await fetch("/api/driver/status", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isOnline: newValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIsOnline(!newValue); // rollback
        toast.error(data?.error || "Gagal mengubah status.");
        return;
      }
      toast.success(newValue ? "Kamu sekarang ONLINE" : "Kamu sekarang OFFLINE");
      if (newValue) fetchOrders();
    } catch {
      setIsOnline(!newValue);
      toast.error("Koneksi bermasalah.");
    }
  }

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/driver/orders/available", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal memuat pesanan.");
        return;
      }
      setAvailable(data.available ?? []);
      setActive(data.active ?? []);
      setError(null);
    } catch {
      setError("Koneksi bermasalah.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 🔔 Realtime: refetch saat READY order masuk atau status berubah
  const { isConnected: socketConnected } = useOrderSocket({
    onEvent: (event) => {
      if (event === "order:status" || event === "order:created") {
        fetchOrders();
      }
    },
  });

  useEffect(() => {
    fetchOrders();
    // Fallback polling
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  async function pickup(orderId: string) {
    setBusy(orderId);
    // 🔥 Optimistic: pindahkan dari available ke active
    const originalAvailable = available;
    const originalActive = active;
    const order = available.find((o) => o.id === orderId);
    if (order) {
      setAvailable((prev) => prev.filter((o) => o.id !== orderId));
      setActive((prev) => [...prev, { ...order, status: "PICKED_UP" as const, pickedUpAt: new Date().toISOString() }]);
    }
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/pickup`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        // Rollback
        setAvailable(originalAvailable);
        setActive(originalActive);
        toast.error(data?.error || "Gagal mengambil order.");
        return;
      }
      toast.success("Order diambil! Antar ke pelanggan.");
      fetchOrders(); // background sync
    } catch {
      setAvailable(originalAvailable);
      setActive(originalActive);
      toast.error("Koneksi bermasalah.");
    } finally {
      setBusy(null);
    }
  }

  async function deliver(orderId: string) {
    setBusy(orderId);
    // 🔥 Optimistic: hapus dari active orders
    const originalActive = active;
    setActive((prev) => prev.filter((o) => o.id !== orderId));
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/deliver`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        // Rollback
        setActive(originalActive);
        toast.error(data?.error || "Gagal menyelesaikan order.");
        return;
      }
      toast.success("Pesanan selesai diantar!");
      fetchOrders(); // background sync
    } catch {
      setActive(originalActive);
      toast.error("Koneksi bermasalah.");
    } finally {
      setBusy(null);
    }
  }

  function renderOrderCard(o: Order, isAvailable: boolean) {
    return (
      <motion.div
        key={o.id}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className={cn(
          "rounded-xl border bg-background/60 p-3",
          isAvailable ? "border-mint/40" : "border-lavender/40",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <code className="font-display text-sm font-700 text-foreground">{o.code}</code>
              <Badge variant="outline" className={cn(
                "h-5 px-1.5 text-[0.6rem] font-700",
                o.status === "READY" ? "border-mint/40 bg-mint/10 text-mint" : "border-lavender/40 bg-lavender/10 text-lavender",
              )}>
                {o.status === "READY" ? "SIAP DIJEMPUT" : "DIANTAR"}
              </Badge>
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Store className="h-3 w-3" />
              <span className="font-600 text-foreground">{o.merchant.restaurantName}</span>
            </p>
            <p className="text-[0.7rem] text-muted-foreground">{o.merchant.address}</p>
          </div>
          <p className="font-display text-sm font-700 text-mint">{formatRupiah(o.total)}</p>
        </div>

        {/* Items */}
        <div className="mt-2 rounded-lg bg-muted/40 p-2">
          {o.items.map((item) => (
            <div key={item.id} className="flex justify-between text-xs">
              <span>
                <span className="font-700 text-mint">{item.quantity}×</span> {item.name}
              </span>
              <span className="text-muted-foreground">{formatRupiah(item.subtotal)}</span>
            </div>
          ))}
        </div>

        {/* Customer + destination */}
        <div className="mt-2 space-y-1 text-xs">
          <p className="flex items-center gap-1.5">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="font-600 text-foreground">{o.customer.name}</span>
            {o.customer.phone && (
              <span className="flex items-center gap-0.5 text-muted-foreground">
                <Phone className="h-2.5 w-2.5" />
                {o.customer.phone}
              </span>
            )}
          </p>
          <p className="flex items-start gap-1.5 text-muted-foreground">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            {o.deliveryAddress}
          </p>
          {o.notes && (
            <p className="italic text-muted-foreground">"{o.notes}"</p>
          )}
        </div>

        {/* Action */}
        <div className="mt-2.5">
          {isAvailable ? (
            <Button
              size="sm"
              onClick={() => pickup(o.id)}
              disabled={busy === o.id}
              className="accent-mint h-8 w-full bg-role text-role-fg hover:opacity-90"
            >
              <Bike className="h-3.5 w-3.5" />
              {busy === o.id ? "Mengambil…" : "Jemput & Antar"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => deliver(o.id)}
              disabled={busy === o.id}
              className="accent-mint h-8 w-full bg-role text-role-fg hover:opacity-90"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {busy === o.id ? "Menyelesaikan…" : "Sudah sampai · Selesai"}
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <>
      {/* Online/Offline toggle */}
      <section className="accent-mint rounded-2xl border border-border bg-card p-4 shadow-card mb-4">
        <button
          type="button"
          onClick={toggleOnline}
          className="flex w-full items-center justify-between press-feedback"
        >
          <div className="flex items-center gap-3">
            <span className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl transition-premium",
              isOnline ? "bg-mint text-mint-foreground" : "bg-muted text-muted-foreground",
            )}>
              {isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            </span>
            <div className="text-left">
              <p className="font-display text-sm font-700 text-foreground">
                {isOnline ? "Online — Siap menerima order" : "Offline — Tidak menerima order"}
              </p>
              <p className="text-[0.65rem] text-muted-foreground">
                {isOnline ? "Kamu akan melihat pesanan siap dijemput" : "Aktifkan untuk mulai menerima order"}
              </p>
            </div>
          </div>
          <span className={cn(
            "flex h-6 w-11 items-center rounded-full p-0.5 transition-premium",
            isOnline ? "bg-mint justify-end" : "bg-muted justify-start",
          )}>
            <span className={cn(
              "h-5 w-5 rounded-full bg-white shadow-sm transition-premium",
            )} />
          </span>
        </button>
      </section>

      {/* Active deliveries (PICKED_UP) */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="accent-mint flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-role text-role-fg">
              <Bike className="h-4.5 w-4.5" strokeWidth={2.2} />
            </span>
            <div>
              <h3 className="font-display text-lg font-700 text-foreground">Pengiriman aktif</h3>
              <p className="text-xs text-muted-foreground">{active.length} sedang diantar</p>
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

        {active.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
            <Bike className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-600 text-foreground">Tidak ada pengiriman aktif</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {active.map((o) => renderOrderCard(o, false))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Available orders (READY) */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <header className="mb-4 flex items-center gap-3">
          <span className="accent-mint flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-role-soft text-role">
            <Package className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
          <div>
            <h3 className="font-display text-lg font-700 text-foreground">Pesanan siap dijemput</h3>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {socketConnected ? (
                <>
                  <Wifi className="h-3 w-3 text-mint" />
                  Real-time aktif · {available.length} tersedia
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  Fallback 30s · {available.length} tersedia
                </>
              )}
            </p>
          </div>
        </header>

        {available.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-600 text-foreground">Belum ada pesanan siap</p>
            <p className="mt-1 text-xs text-muted-foreground">Order READY akan muncul di sini.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {available.map((o) => renderOrderCard(o, true))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </>
  );
}
