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
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border bg-card p-4">
                <div>
                  <h2 className="font-display text-lg font-700 text-foreground">Keranjang</h2>
                  {restaurantName && (
                    <p className="text-xs text-muted-foreground">{restaurantName}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-muted/70"
                  aria-label="Tutup"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto scroll-slim p-4">
                {items.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    <ShoppingBag className="mx-auto h-8 w-8" />
                    <p className="mt-2 font-600">Keranjang kosong</p>
                    <p className="mt-1 text-xs">Tambahkan menu dari restoran untuk memesan.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <motion.div
                        key={item.menuItemId}
                        layout
                        className="rounded-xl border border-border bg-card p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-700 text-foreground">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.category} · {formatRupiah(item.price)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.menuItemId)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Hapus ${item.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background hover:border-saffron hover:bg-saffron/10"
                              aria-label="Kurangi"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="min-w-[2rem] text-center font-700 tabular-nums">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background hover:border-saffron hover:bg-saffron/10"
                              aria-label="Tambah"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="font-display text-sm font-700 text-saffron">
                            {formatRupiah(item.price * item.quantity)}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {items.length > 0 && (
                <div className="shrink-0 space-y-3 border-t border-border bg-card p-4">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{formatRupiah(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Ongkos antar</span>
                      <span className="tabular-nums">{formatRupiah(deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-1 font-700 text-foreground">
                      <span>Total</span>
                      <span className="font-display tabular-nums">{formatRupiah(total)}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setCheckoutOpen(true)}
                    className="accent-saffron h-10 w-full bg-role text-role-fg hover:opacity-90"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Checkout · {formatRupiah(total)}
                  </Button>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="w-full text-center text-xs text-muted-foreground hover:text-destructive"
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
