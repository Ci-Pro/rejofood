"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CreditCard, Banknote, QrCode, Wallet, Loader2, CheckCircle2, XCircle,
  Clock, ArrowRight, ExternalLink, AlertCircle,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrderSocket } from "@/hooks/use-order-socket";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PaymentMethod = "COD" | "WALLET" | "QRIS" | "VA_BCA" | "VA_MANDIRI" | "VA_BNI" | "EWALLET_GOPAY" | "EWALLET_OVO" | "EWALLET_DANA";
type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";

interface PaymentInfo {
  id: string;
  code: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  paymentUrl: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  metadata: Record<string, unknown> | null;
}

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderCode: string;
  total: number;
  /** Existing payment (jika sudah ada — untuk re-show instruksi) */
  existingPayment?: PaymentInfo | null;
  onPaid?: () => void;
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

function methodIcon(method: PaymentMethod) {
  if (method === "COD") return <Banknote className="h-4 w-4" />;
  if (method === "QRIS") return <QrCode className="h-4 w-4" />;
  if (method.startsWith("VA_")) return <CreditCard className="h-4 w-4" />;
  return <Wallet className="h-4 w-4" />;
}

function methodLabel(method: PaymentMethod): string {
  const map: Record<PaymentMethod, string> = {
    COD: "Cash (COD)",
    WALLET: "RejoPay (Saldo)",
    QRIS: "QRIS",
    VA_BCA: "VA BCA",
    VA_MANDIRI: "VA Mandiri",
    VA_BNI: "VA BNI",
    EWALLET_GOPAY: "GoPay",
    EWALLET_OVO: "OVO",
    EWALLET_DANA: "DANA",
  };
  return map[method] ?? method;
}

const METHODS: { value: PaymentMethod; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "WALLET", label: "RejoPay", desc: "Bayar pakai saldo dompet", icon: <Wallet className="h-5 w-5" /> },
  { value: "COD", label: "Cash (COD)", desc: "Bayar tunai ke driver", icon: <Banknote className="h-5 w-5" /> },
  { value: "QRIS", label: "QRIS", desc: "Semua e-wallet & m-banking", icon: <QrCode className="h-5 w-5" /> },
  { value: "VA_BCA", label: "VA BCA", desc: "Transfer via BCA", icon: <CreditCard className="h-5 w-5" /> },
  { value: "VA_MANDIRI", label: "VA Mandiri", desc: "Transfer via Mandiri", icon: <CreditCard className="h-5 w-5" /> },
  { value: "VA_BNI", label: "VA BNI", desc: "Transfer via BNI", icon: <CreditCard className="h-5 w-5" /> },
  { value: "EWALLET_GOPAY", label: "GoPay", desc: "Bayar via GoPay", icon: <Wallet className="h-5 w-5" /> },
  { value: "EWALLET_OVO", label: "OVO", desc: "Bayar via OVO", icon: <Wallet className="h-5 w-5" /> },
  { value: "EWALLET_DANA", label: "DANA", desc: "Bayar via DANA", icon: <Wallet className="h-5 w-5" /> },
];

export function PaymentDialog({
  open,
  onClose,
  orderId,
  orderCode,
  total,
  existingPayment,
  onPaid,
}: PaymentDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("WALLET");
  const [creating, setCreating] = useState(false);
  const [payment, setPayment] = useState<PaymentInfo | null>(existingPayment ?? null);
  const [simulating, setSimulating] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  // Fetch wallet balance when dialog opens (untuk display di opsi WALLET)
  useEffect(() => {
    if (!open) return;
    setWalletLoading(true);
    fetch("/api/wallet")
      .then((r) => r.json())
      .then((d) => {
        if (d?.wallet) setWalletBalance(d.wallet.balance);
        else setWalletBalance(null);
      })
      .catch(() => setWalletBalance(null))
      .finally(() => setWalletLoading(false));
  }, [open]);

  // Reset state saat dialog open berubah
  useEffect(() => {
    if (open) {
      setPayment(existingPayment ?? null);
    }
  }, [open, existingPayment]);

  // 🔔 Realtime: listen for payment status update
  useOrderSocket({
    onEvent: (event, data) => {
      if (event === "order:status" && data?.code === orderCode && payment) {
        const newStatus = data.to === "PAID" ? "SUCCESS" : (data.to as PaymentStatus);
        if (newStatus === "SUCCESS") {
          setPayment({ ...payment, status: "SUCCESS", paidAt: new Date().toISOString() });
          toast.success("Pembayaran berhasil!");
          onPaid?.();
        }
      }
    },
  });

  async function createPayment() {
    setCreating(true);
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, method: selectedMethod }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Gagal membuat pembayaran.");
        return;
      }
      setPayment(data.payment);
      if (data.payment?.status === "SUCCESS") {
        const msg = selectedMethod === "WALLET"
          ? "Pembayaran RejoPay berhasil!"
          : selectedMethod === "COD"
            ? "Pembayaran COD berhasil!"
            : "Pembayaran berhasil!";
        toast.success(msg);
        onPaid?.();
      } else {
        toast.info(`Payment ${data.payment?.code ?? ""} dibuat. Selesaikan pembayaran sebelum expiry.`);
      }
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setCreating(false);
    }
  }

  async function simulatePaymentSuccess() {
    if (!payment) return;
    setSimulating(true);
    try {
      const res = await fetch("/api/payment/mock-notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentCode: payment.code, transactionStatus: "settlement" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Gagal simulate payment.");
        return;
      }
      setPayment({ ...payment, status: "SUCCESS", paidAt: data.payment?.paidAt });
      toast.success("Pembayaran berhasil dikonfirmasi!");
      onPaid?.();
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setSimulating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-saffron" />
            Pembayaran
          </DialogTitle>
          <DialogDescription>
            Order <span className="font-700 text-foreground">{orderCode}</span> · Total{" "}
            <span className="font-display font-700 text-saffron">{formatRupiah(total)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {/* SUCCESS state */}
          {payment?.status === "SUCCESS" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-mint/30 bg-mint/10 p-5 text-center"
            >
              <CheckCircle2 className="mx-auto h-12 w-12 text-mint" />
              <p className="mt-2 font-display text-lg font-700 text-foreground">Pembayaran berhasil</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {methodLabel(payment.method)} · {payment.code}
              </p>
              <p className="mt-2 text-sm text-foreground">
                Restoran akan segera memproses pesananmu.
              </p>
            </motion.div>
          )}

          {/* FAILED state */}
          {payment?.status === "FAILED" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-rose/30 bg-rose/10 p-5 text-center"
            >
              <XCircle className="mx-auto h-12 w-12 text-rose" />
              <p className="mt-2 font-display text-lg font-700 text-foreground">Pembayaran gagal/expired</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Silakan pilih metode lain dan coba lagi.
              </p>
              <Button
                onClick={() => setPayment(null)}
                className="mt-3 accent-saffron bg-role text-role-fg hover:opacity-90"
                size="sm"
              >
                Pilih metode lain
              </Button>
            </motion.div>
          )}

          {/* Method selection (no payment yet) */}
          {!payment && (
            <div className="space-y-2">
              <p className="mb-2 text-xs font-600 uppercase tracking-wide text-muted-foreground">
                Pilih metode pembayaran
              </p>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map((m) => {
                  const walletInsufficient = m.value === "WALLET" && walletBalance !== null && walletBalance < total;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setSelectedMethod(m.value)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-colors",
                        selectedMethod === m.value
                          ? "accent-saffron border-role bg-role-soft ring-role"
                          : "border-border bg-card hover:border-role/40",
                        walletInsufficient && "opacity-60",
                      )}
                    >
                      <span className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        selectedMethod === m.value ? "bg-role text-role-fg" : "bg-muted text-muted-foreground",
                      )}>
                        {m.icon}
                      </span>
                      <span className="text-xs font-700 text-foreground">{m.label}</span>
                      {m.value === "WALLET" && (
                        <span className={cn(
                          "block truncate text-[0.65rem] font-600",
                          walletLoading
                            ? "text-muted-foreground"
                            : walletBalance === null
                              ? "text-muted-foreground"
                              : walletBalance < total
                                ? "text-rose-500"
                                : "text-emerald-600 dark:text-emerald-400",
                        )}>
                          {walletLoading
                            ? "Memuat saldo..."
                            : walletBalance === null
                              ? m.desc
                              : `Saldo: ${formatRupiah(walletBalance)}`}
                        </span>
                      )}
                      {m.value !== "WALLET" && (
                        <span className="text-[0.65rem] text-muted-foreground">{m.desc}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Wallet insufficient warning */}
              {selectedMethod === "WALLET" && walletBalance !== null && walletBalance < total && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div>
                      <p className="font-700">Saldo RejoPay tidak cukup</p>
                      <p className="mt-0.5">
                        Saldo: {formatRupiah(walletBalance)} • Dibutuhkan: {formatRupiah(total)}.
                        Kekurangan: {formatRupiah(total - walletBalance)}.
                      </p>
                      <p className="mt-0.5">Top up dulu atau pilih metode lain.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PENDING state — show instructions */}
          {payment?.status === "PENDING" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-600 text-foreground">
                    {methodIcon(payment.method)}
                    {methodLabel(payment.method)}
                  </span>
                  <Badge variant="outline" className="h-5 border-saffron/40 bg-saffron/10 px-1.5 text-[0.6rem] font-700 text-saffron">
                    <Clock className="h-2.5 w-2.5" /> MENUNGGU
                  </Badge>
                </div>
                {payment.expiresAt && (
                  <p className="mt-1 text-[0.65rem] text-muted-foreground">
                    Expire: {new Date(payment.expiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>

              {/* Method-specific instructions */}
              {payment.metadata?.instruction && (
                <div className="rounded-xl border border-border bg-card p-3 text-xs">
                  <p className="font-700 text-foreground">Instruksi:</p>
                  <p className="mt-1 text-muted-foreground">{payment.metadata.instruction as string}</p>
                  {payment.metadata.vaNumber && (
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/50 p-2">
                      <span className="text-[0.65rem] text-muted-foreground">Nomor VA:</span>
                      <code className="font-mono text-sm font-700 text-foreground">{payment.metadata.vaNumber as string}</code>
                    </div>
                  )}
                  {payment.metadata.qrString && (
                    <div className="mt-2 flex flex-col items-center rounded-lg bg-muted/50 p-3">
                      <QrCode className="h-16 w-16 text-foreground" />
                      <p className="mt-1 text-[0.65rem] text-muted-foreground">Scan QR dengan e-wallet/m-banking</p>
                    </div>
                  )}
                </div>
              )}

              {/* Payment URL */}
              {payment.paymentUrl && (
                <a
                  href={payment.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-saffron/40 bg-saffron/10 px-3 py-2 text-xs font-700 text-saffron hover:bg-saffron/20"
                >
                  <ExternalLink className="h-3 w-3" />
                  Buka halaman pembayaran (mock gateway)
                </a>
              )}

              {/* DEV: Mock simulator — di production, ini otomatis dari gateway webhook */}
              <div className="rounded-xl border border-dashed border-saffron/40 bg-saffron/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-700 text-saffron">
                  <AlertCircle className="h-3 w-3" />
                  Dev Mode: Simulasi konfirmasi pembayaran
                </p>
                <p className="mt-1 text-[0.65rem] text-muted-foreground">
                  Di production, tombol ini tidak ada — gateway akan otomatis notify via webhook.
                </p>
                <Button
                  type="button"
                  onClick={simulatePaymentSuccess}
                  disabled={simulating}
                  className="accent-saffron mt-2 h-8 w-full bg-role text-role-fg hover:opacity-90"
                  size="sm"
                >
                  {simulating ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memproses…</>
                  ) : (
                    <><CheckCircle2 className="h-3.5 w-3.5" /> Saya sudah bayar (simulate)</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {!payment && (
            <>
              <Button variant="outline" onClick={onClose} disabled={creating}>
                Batal
              </Button>
              <Button
                onClick={createPayment}
                disabled={creating || (selectedMethod === "WALLET" && walletBalance !== null && walletBalance < total)}
                className="accent-saffron bg-role text-role-fg hover:opacity-90"
              >
                {creating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Membuat…</>
                ) : (
                  <><ArrowRight className="h-4 w-4" /> Bayar {formatRupiah(total)}</>
                )}
              </Button>
            </>
          )}
          {payment?.status === "SUCCESS" && (
            <Button onClick={onClose} className="accent-mint bg-role text-role-fg hover:opacity-90">
              <CheckCircle2 className="h-4 w-4" /> Selesai
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
