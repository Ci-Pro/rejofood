"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, RefreshCw, ChevronRight, Wifi, WifiOff, X, Ban, Loader2, CreditCard, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useOrderSocket } from "@/hooks/use-order-socket";
import { toast } from "sonner";
import { PaymentDialog } from "./payment-dialog";
import { ReviewDialog } from "./review-dialog";

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
  payment: {
    id: string;
    code: string;
    method: string;
    status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
    amount: number;
    paymentUrl: string | null;
    expiresAt: string | null;
    paidAt: string | null;
  } | null;
  review: { id: string; rating: number; comment: string | null; createdAt: string } | null;
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
  // Cancel dialog state
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  // Payment dialog state
  const [payTarget, setPayTarget] = useState<Order | null>(null);
  // Review dialog state
  const [reviewTarget, setReviewTarget] = useState<Order | null>(null);

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

  // 🔔 Realtime: refetch saat event masuk, fallback polling 30s (longer, karena socket utama)
  const { isConnected: socketConnected } = useOrderSocket({
    onEvent: (event, data) => {
      // Refetch untuk semua order events (status change, new order)
      if (event === "order:status" || event === "order:created") {
        fetchOrders();
      }
    },
  });

  useEffect(() => {
    fetchOrders();
    // Fallback polling — slower now (30s) karena socket utama
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  function openCancelDialog(order: Order) {
    setCancelTarget(order);
    setCancelReason("");
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${cancelTarget.id}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Gagal membatalkan order.");
        return;
      }
      toast.success(`Order ${cancelTarget.code} dibatalkan.`);
      setCancelTarget(null);
      setCancelReason("");
      // Close detail drawer if open
      if (selected?.id === cancelTarget.id) setSelected(null);
      await fetchOrders();
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="accent-saffron flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-role text-role-fg">
            <Package className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
          <div>
            <h3 className="font-display text-lg font-700 text-foreground">Pesanan saya</h3>
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
          {orders.map((o, idx) => {
            const canCancel = ["PENDING", "ACCEPTED", "PREPARING"].includes(o.status);
            const needsPayment = o.status === "PENDING" && o.payment?.status !== "SUCCESS";
            const canReview = o.status === "DELIVERED" && !o.review;
            return (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="accent-saffron flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3 hover:border-role/40"
              >
                <button
                  type="button"
                  onClick={() => setSelected(o)}
                  className="min-w-0 flex-1 text-left"
                  aria-label={`Lihat detail ${o.code}`}
                >
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-700 text-foreground">{o.code}</code>
                    <Badge variant="outline" className={cn("h-4 px-1.5 text-[0.6rem] font-700", statusBadgeClass(o.status))}>
                      {statusLabel(o.status)}
                    </Badge>
                    {o.payment && o.payment.status !== "SUCCESS" && o.status !== "CANCELLED" && (
                      <Badge variant="outline" className={cn(
                        "h-4 px-1.5 text-[0.55rem] font-700",
                        o.payment.status === "PENDING" && "border-saffron/40 bg-saffron/10 text-saffron",
                        o.payment.status === "FAILED" && "border-rose/40 bg-rose/10 text-rose",
                        o.payment.status === "REFUNDED" && "border-lavender/40 bg-lavender/10 text-lavender",
                      )}>
                        {o.payment.status === "PENDING" ? "BELUM BAYAR" : o.payment.status}
                      </Badge>
                    )}
                    {o.review && (
                      <Badge variant="outline" className="h-4 border-saffron/40 bg-saffron/10 px-1.5 text-[0.55rem] font-700 text-saffron">
                        <Star className="mr-0.5 h-2 w-2 fill-saffron" />
                        {o.review.rating}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm font-600 text-foreground">{o.merchant.restaurantName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {o.itemCount} item · {formatTime(o.createdAt)}
                  </p>
                </button>
                <div className="shrink-0 text-right">
                  <p className="font-display text-sm font-700 text-saffron">{formatRupiah(o.total)}</p>
                  {needsPayment ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPayTarget(o); }}
                      className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-saffron/40 bg-saffron/10 px-2 py-0.5 text-[0.65rem] font-700 text-saffron hover:bg-saffron/20"
                    >
                      <CreditCard className="h-2.5 w-2.5" />
                      Bayar
                    </button>
                  ) : canReview ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setReviewTarget(o); }}
                      className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-saffron/40 bg-saffron/10 px-2 py-0.5 text-[0.65rem] font-700 text-saffron hover:bg-saffron/20"
                    >
                      <Star className="h-2.5 w-2.5" />
                      Beri Penilaian
                    </button>
                  ) : canCancel ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openCancelDialog(o); }}
                      className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[0.65rem] font-700 text-destructive hover:border-destructive/40 hover:bg-destructive/10"
                    >
                      <Ban className="h-2.5 w-2.5" />
                      Batalkan
                    </button>
                  ) : (
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
              </motion.div>
            );
          })}
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

                {/* Cancel button in detail drawer */}
                {["PENDING", "ACCEPTED", "PREPARING"].includes(selected.status) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openCancelDialog(selected)}
                    className="h-9 w-full text-destructive hover:bg-destructive/10"
                  >
                    <Ban className="h-4 w-4" />
                    Batalkan pesanan
                  </Button>
                )}
                {selected.status === "CANCELLED" && selected.notes && (
                  <div className="rounded-xl border border-rose/30 bg-rose/5 p-3 text-xs text-rose">
                    <p className="font-700">Alasan pembatalan:</p>
                    <p className="mt-0.5">{selected.notes.split("[CANCELLED oleh customer:")[1]?.replace("]", "") ?? selected.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cancel dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && !cancelling && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Batalkan pesanan {cancelTarget?.code}?
            </DialogTitle>
            <DialogDescription>
              Pesanan ke <span className="font-700 text-foreground">{cancelTarget?.merchant.restaurantName}</span> akan dibatalkan.
              {cancelTarget?.status === "PREPARING" && (
                <span className="mt-2 block rounded-lg bg-saffron/10 p-2 text-xs text-saffron">
                  ⚠️ Restoran sudah mulai memproses pesanan ini. Pembatalan sekarang mungkin
                  menyebabkan kerugian untuk merchant.
                </span>
              )}
              {cancelTarget?.status === "ACCEPTED" && (
                <span className="mt-2 block text-xs text-muted-foreground">
                  Pesanan sudah diterima restoran. Pembatalan tetap bisa dilakukan.
                </span>
              )}
              {cancelTarget?.status === "PENDING" && (
                <span className="mt-2 block text-xs text-muted-foreground">
                  Pesanan belum diterima restoran. Pembatalan aman dilakukan.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <label className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
              Alasan <span className="text-muted-foreground/60">(opsional, maks 300 karakter)</span>
            </label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Contoh: salah pesan, berubah pikiran, alamat salah…"
              rows={3}
              maxLength={300}
              className="resize-none"
              disabled={cancelling}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={confirmCancel}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Membatalkan…</>
              ) : (
                <><Ban className="h-4 w-4" /> Ya, batalkan</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      {payTarget && (
        <PaymentDialog
          open={!!payTarget}
          onClose={() => setPayTarget(null)}
          orderId={payTarget.id}
          orderCode={payTarget.code}
          total={payTarget.total}
          onPaid={() => {
            fetchOrders();
          }}
        />
      )}

      {/* Review dialog */}
      {reviewTarget && (
        <ReviewDialog
          open={!!reviewTarget}
          onClose={() => setReviewTarget(null)}
          orderId={reviewTarget.id}
          orderCode={reviewTarget.code}
          restaurantName={reviewTarget.merchant.restaurantName}
          onSubmitted={() => {
            fetchOrders();
          }}
        />
      )}
    </section>
  );
}
