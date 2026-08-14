"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Receipt, X, Printer, CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface InvoiceData {
  code: string;
  status: string;
  createdAt: string;
  deliveredAt: string | null;
  merchant: { name: string; address: string | null; cuisine: string | null };
  driver: { name: string } | null;
  items: Array<{ name: string; quantity: number; price: number; subtotal: number }>;
  subtotal: number;
  deliveryFee: number;
  discountAmount?: number;
  promoCode?: string | null;
  total: number;
  deliveryAddress: string;
  notes: string | null;
  payment: { method: string; status: string; code: string; paidAt: string | null } | null;
  review: { rating: number; comment: string | null } | null;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  DELIVERED: <CheckCircle2 className="h-4 w-4 text-mint" />,
  CANCELLED: <XCircle className="h-4 w-4 text-rose" />,
  PENDING: <Clock className="h-4 w-4 text-saffron" />,
};

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function InvoiceDialog({
  orderId,
  open,
  onClose,
}: {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId || !open) return;
    setLoading(true);
    setInvoice(null);
    fetch(`/api/orders/${orderId}/invoice`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.invoice) setInvoice(d.invoice); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId, open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Invoice
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : invoice ? (
          <div className="space-y-3 text-sm">
            {/* Header */}
            <div className="rounded-xl bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-lg font-700 text-foreground">{invoice.code}</p>
                  <p className="text-[0.65rem] text-muted-foreground">{formatDateTime(invoice.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {STATUS_ICON[invoice.status]}
                  <span className="text-xs font-700">{invoice.status}</span>
                </div>
              </div>
            </div>

            {/* Merchant info */}
            <div>
              <p className="text-[0.6rem] font-700 uppercase tracking-wide text-muted-foreground">Restoran</p>
              <p className="font-600 text-foreground">{invoice.merchant.name}</p>
              {invoice.merchant.address && (
                <p className="text-xs text-muted-foreground">{invoice.merchant.address}</p>
              )}
            </div>

            {/* Delivery address */}
            <div>
              <p className="text-[0.6rem] font-700 uppercase tracking-wide text-muted-foreground">Alamat Pengantaran</p>
              <p className="text-xs text-foreground">{invoice.deliveryAddress}</p>
            </div>

            {/* Items */}
            <div>
              <p className="mb-1 text-[0.6rem] font-700 uppercase tracking-wide text-muted-foreground">Detail Pesanan</p>
              <div className="space-y-1">
                {invoice.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">
                      <span className="font-700 text-saffron">{item.quantity}×</span> {item.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{formatRupiah(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-0.5 rounded-xl border border-border p-3 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatRupiah(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Ongkos antar</span>
                <span className="tabular-nums">{formatRupiah(invoice.deliveryFee)}</span>
              </div>
              {invoice.discountAmount && invoice.discountAmount > 0 && (
                <div className="flex justify-between text-mint">
                  <span>Diskon {invoice.promoCode}</span>
                  <span className="tabular-nums">-{formatRupiah(invoice.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1 font-700 text-foreground">
                <span>Total</span>
                <span className="tabular-nums">{formatRupiah(invoice.total)}</span>
              </div>
            </div>

            {/* Payment info */}
            {invoice.payment && (
              <div>
                <p className="text-[0.6rem] font-700 uppercase tracking-wide text-muted-foreground">Pembayaran</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-600 text-foreground">{invoice.payment.method}</span>
                  <Badge variant="outline" className={cn(
                    "h-4 px-1.5 text-[0.55rem] font-700",
                    invoice.payment.status === "SUCCESS" && "border-mint/40 bg-mint/10 text-mint",
                    invoice.payment.status === "REFUNDED" && "border-lavender/40 bg-lavender/10 text-lavender",
                    invoice.payment.status === "PENDING" && "border-saffron/40 bg-saffron/10 text-saffron",
                    invoice.payment.status === "FAILED" && "border-rose/40 bg-rose/10 text-rose",
                  )}>
                    {invoice.payment.status}
                  </Badge>
                  <span className="text-muted-foreground">{invoice.payment.code}</span>
                </div>
              </div>
            )}

            {/* Driver info */}
            {invoice.driver && (
              <div>
                <p className="text-[0.6rem] font-700 uppercase tracking-wide text-muted-foreground">Driver</p>
                <p className="text-xs text-foreground">{invoice.driver.name}</p>
              </div>
            )}

            {/* Delivered time */}
            {invoice.deliveredAt && (
              <div>
                <p className="text-[0.6rem] font-700 uppercase tracking-wide text-muted-foreground">Selesai</p>
                <p className="text-xs text-foreground">{formatDateTime(invoice.deliveredAt)}</p>
              </div>
            )}

            {/* Review */}
            {invoice.review && (
              <div>
                <p className="text-[0.6rem] font-700 uppercase tracking-wide text-muted-foreground">Ulasan Anda</p>
                <div className="flex items-center gap-1 text-xs">
                  <span className="font-700 text-saffron">★ {invoice.review.rating}</span>
                  {invoice.review.comment && (
                    <span className="text-muted-foreground">— "{invoice.review.comment.slice(0, 80)}"</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Gagal memuat invoice.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => window.print()} disabled={loading || !invoice}>
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </Button>
          <Button onClick={onClose}>
            <X className="h-4 w-4" />
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
