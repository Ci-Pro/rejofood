"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, MapPin, MessageSquare, ShoppingBag, Route, Navigation } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCartStore } from "@/store/cart-store";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function formatRupiah(n: number): string {
  if (n === 0) return "GRATIS";
  return "Rp " + n.toLocaleString("id-ID");
}

interface CreatedOrder {
  id: string;
  code: string;
}

interface DeliveryEstimate {
  distanceKm: number;
  durationMin: number | null;
  fee: number;
  feeFormatted: string;
  distanceFormatted: string;
  method: string;
}

export function CheckoutDialog({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: (order: CreatedOrder) => void;
}) {
  const items = useCartStore((s) => s.items);
  const merchantId = useCartStore((s) => s.merchantId);
  const restaurantName = useCartStore((s) => s.restaurantName);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const clearCart = useCartStore((s) => s.clearCart);
  const user = useAuthStore((s) => s.user);

  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);

  // Prefill address dari customer profile
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (data.defaultAddress) setAddress(data.defaultAddress);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  // Estimate delivery fee when address changes (debounced)
  const estimateDelivery = useCallback(async (addr: string, mId: string | null) => {
    if (!mId || addr.trim().length < 5) {
      setDelivery(null);
      return;
    }
    setEstimating(true);
    try {
      const res = await fetch("/api/delivery/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ merchantId: mId, deliveryAddress: addr.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setDelivery(data);
      } else {
        setDelivery(null);
      }
    } catch {
      setDelivery(null);
    } finally {
      setEstimating(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => estimateDelivery(address, merchantId), 500);
    return () => clearTimeout(t);
  }, [address, merchantId, estimateDelivery]);

  const deliveryFee = delivery?.fee ?? 8000; // fallback flat fee
  const total = subtotal + deliveryFee;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (address.trim().length < 5) {
      toast.error("Alamat pengantaran minimal 5 karakter.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
          deliveryAddress: address.trim(),
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Gagal membuat pesanan.");
        return;
      }
      toast.success(`Order ${data.order.code} dibuat!`, {
        description: "Menunggu konfirmasi restoran.",
      });
      clearCart();
      onSubmitted({ id: data.order.id, code: data.order.code });
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-2">
          {/* Summary */}
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <p className="font-700 text-foreground">{restaurantName}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {items.length} item · {items.reduce((s, i) => s + i.quantity, 0)} porsi
            </p>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="address" className="flex items-center gap-1.5 text-xs font-600 uppercase tracking-wide text-muted-foreground">
              <MapPin className="h-3 w-3" /> Alamat pengantaran
            </Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Jl. Contoh No. 123, RT 01/RW 02, Jakarta Selatan. Patokan: depan minimarket."
              rows={2}
              required
              className="resize-none"
              autoFocus
            />
          </div>

          {/* Delivery estimate */}
          {address.trim().length >= 5 && (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Route className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-600 text-muted-foreground">Estimasi pengiriman</span>
                </div>
                {estimating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : delivery ? (
                  <div className="flex items-center gap-2 text-xs">
                    {delivery.distanceKm > 0 && (
                      <span className="flex items-center gap-0.5 text-muted-foreground">
                        <Navigation className="h-3 w-3" />
                        {delivery.distanceFormatted}
                      </span>
                    )}
                    {delivery.durationMin && (
                      <span className="text-muted-foreground">· ~{delivery.durationMin} min</span>
                    )}
                  </div>
                ) : null}
              </div>
              {delivery && (
                <p className="mt-1.5 text-sm font-700 text-saffron">
                  Ongkir: {delivery.feeFormatted}
                </p>
              )}
              {delivery && delivery.method === "haversine" && delivery.distanceKm > 0 && (
                <p className="mt-0.5 text-[0.6rem] text-muted-foreground/60">
                  * Estimasi berdasarkan jarak lurus. Aktifkan Google Maps API untuk akurasi lebih baik.
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="flex items-center gap-1.5 text-xs font-600 uppercase tracking-wide text-muted-foreground">
              <MessageSquare className="h-3 w-3" /> Catatan <span className="text-muted-foreground/60">(opsional)</span>
            </Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tanpa sambal, pedasnya sedang, dll."
              className="h-10"
            />
          </div>

          {/* Price breakdown */}
          <div className="space-y-1 rounded-xl border border-border bg-card p-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatRupiah(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Ongkos antar</span>
              <span className="tabular-nums">
                {estimating ? (
                  <Loader2 className="inline h-3 w-3 animate-spin" />
                ) : delivery ? (
                  delivery.feeFormatted
                ) : formatRupiah(8000)}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 font-700 text-foreground">
              <span>Total</span>
              <span className="font-display tabular-nums">{formatRupiah(total)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="accent-saffron bg-role text-role-fg hover:opacity-90"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Memproses…</>
              ) : (
                <><ShoppingBag className="h-4 w-4" /> Buat pesanan · {formatRupiah(total)}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
