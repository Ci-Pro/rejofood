"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, X, Plus, Minus, Trash2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/cart-store";
import { CheckoutDialog } from "./checkout-dialog";
import { PaymentDialog } from "./payment-dialog";
import { cn } from "@/lib/utils";

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

export function CartButton() {
  const [open, setOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<{ id: string; code: string; total: number } | null>(null);
  const items = useCartStore((s) => s.items);
  const restaurantName = useCartStore((s) => s.restaurantName);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const deliveryFee = useCartStore((s) => s.getDeliveryFee());
  const total = useCartStore((s) => s.getTotal());
  const totalItems = useCartStore((s) => s.getTotalItems());

  return (
    <>
      {/* Floating button — premium FAB */}
      <AnimatePresence>
        {totalItems > 0 && !open && (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 30 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            whileTap={{ scale: 0.95 }}
            className="accent-saffron fixed bottom-20 right-4 z-40 flex items-center gap-2.5 rounded-2xl bg-role px-4 py-3.5 text-role-fg shadow-fab lg:bottom-8 lg:right-8"
          >
            <span className="relative">
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose px-1 text-[0.55rem] font-700 text-rose-foreground">
                {totalItems}
              </span>
            </span>
            <span className="font-700 text-sm">{formatRupiah(total)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Tutup keranjang"
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="accent-saffron fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              {/* Header — modern with drag handle */}
              <div className="shrink-0 border-b border-border bg-card">
                {/* Drag handle indicator (visual only) */}
                <div className="flex justify-center pt-2.5 pb-1">
                  <div className="h-1 w-10 rounded-full bg-border" />
                </div>
                <div className="flex items-center justify-between p-4 pt-2">
                  <div>
                    <h2 className="font-display text-lg font-700 text-foreground">Keranjang</h2>
                    {restaurantName && (
                      <p className="text-xs text-muted-foreground">{restaurantName}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-premium hover:bg-muted active:scale-95"
                    aria-label="Tutup"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto scroll-slim p-4">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary">
                      <ShoppingBag className="h-9 w-9 text-muted-foreground" />
                    </div>
                    <p className="mt-4 font-display text-lg font-700 text-foreground">Keranjang kosong</p>
                    <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                      Tambahkan menu dari restoran untuk memesan.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <motion.div
                        key={item.menuItemId}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="rounded-2xl border border-border bg-card p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-700 text-foreground">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.category} · {formatRupiah(item.price)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.menuItemId)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-premium hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Hapus ${item.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between">
                          {/* Quantity stepper — modern native style */}
                          <div className="flex items-center gap-1 rounded-full border border-border bg-background p-0.5">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-premium hover:bg-muted active:scale-90"
                              aria-label="Kurangi"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="min-w-[1.75rem] text-center text-sm font-700 tabular-nums">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-premium hover:bg-primary/90 active:scale-90"
                              aria-label="Tambah"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="font-display text-base font-700 text-primary">
                            {formatRupiah(item.price * item.quantity)}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer — modern summary */}
              {items.length > 0 && (
                <div className="shrink-0 space-y-3 border-t border-border bg-card p-4 pb-6">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal ({items.length} item)</span>
                      <span className="tabular-nums">{formatRupiah(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Ongkos antar</span>
                      <span className="tabular-nums">{formatRupiah(deliveryFee)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-2">
                      <span className="font-700 text-foreground">Total</span>
                      <span className="font-display text-lg font-700 tabular-nums text-foreground">{formatRupiah(total)}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setCheckoutOpen(true)}
                    className="accent-saffron h-12 w-full rounded-2xl bg-role text-role-fg shadow-fab transition-premium hover:opacity-90 active:scale-[0.98]"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Checkout · {formatRupiah(total)}
                  </Button>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="w-full text-center text-xs font-600 text-muted-foreground transition-premium hover:text-destructive"
                  >
                    Kosongkan keranjang
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Checkout dialog */}
      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onSubmitted={(order) => {
          setCheckoutOpen(false);
          setOpen(false);
          // Auto-open payment dialog after checkout
          setPaymentOrder(order);
        }}
      />

      {/* Payment dialog — auto-opens after checkout */}
      {paymentOrder && (
        <PaymentDialog
          open={!!paymentOrder}
          onClose={() => setPaymentOrder(null)}
          orderId={paymentOrder.id}
          orderCode={paymentOrder.code}
          total={paymentOrder.total}
          onPaid={() => {
            setPaymentOrder(null);
          }}
        />
      )}
    </>
  );
}
