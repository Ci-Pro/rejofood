"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Loader2, Copy, CheckCircle2, Clock, ArrowRight,
  QrCode, CreditCard, Building2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TopupMethod = "QRIS" | "VA_BCA" | "VA_MANDIRI" | "VA_BNI" | "EWALLET_GOPAY" | "EWALLET_OVO" | "EWALLET_DANA";

interface TopupResult {
  txId: string;
  txCode: string;
  amount: number;
  method: TopupMethod;
  methodLabel: string;
  paymentUrl: string;
  vaNumber: string | null;
  expiresAt: string;
}

const PRESETS = [25000, 50000, 100000, 200000, 500000, 1000000];

const METHODS: { value: TopupMethod; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "QRIS", label: "QRIS", desc: "Semua e-wallet & m-banking", icon: <QrCode className="h-4 w-4" /> },
  { value: "VA_BCA", label: "VA BCA", desc: "Transfer via BCA", icon: <Building2 className="h-4 w-4" /> },
  { value: "VA_MANDIRI", label: "VA Mandiri", desc: "Transfer via Mandiri", icon: <Building2 className="h-4 w-4" /> },
  { value: "VA_BNI", label: "VA BNI", desc: "Transfer via BNI", icon: <Building2 className="h-4 w-4" /> },
  { value: "EWALLET_GOPAY", label: "GoPay", desc: "Bayar via GoPay", icon: <Wallet className="h-4 w-4" /> },
  { value: "EWALLET_OVO", label: "OVO", desc: "Bayar via OVO", icon: <Wallet className="h-4 w-4" /> },
  { value: "EWALLET_DANA", label: "DANA", desc: "Bayar via DANA", icon: <Wallet className="h-4 w-4" /> },
];

function methodIcon(method: TopupMethod) {
  if (method === "QRIS") return <QrCode className="h-4 w-4" />;
  if (method.startsWith("VA_")) return <Building2 className="h-4 w-4" />;
  return <Wallet className="h-4 w-4" />;
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

interface TopUpDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (newBalance: number) => void;
  accent?: "saffron" | "lavender" | "mint" | "rose";
}

export function TopUpDialog({ open, onClose, onSuccess, accent = "saffron" }: TopUpDialogProps) {
  const [step, setStep] = useState<"amount" | "method" | "instruction" | "success">("amount");
  const [amount, setAmount] = useState<number>(50000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [method, setMethod] = useState<TopupMethod>("QRIS");
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<TopupResult | null>(null);
  const [finalBalance, setFinalBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setStep("amount");
    setAmount(50000);
    setCustomAmount("");
    setMethod("QRIS");
    setResult(null);
    setFinalBalance(null);
    setCopied(false);
  }

  function handleClose() {
    onClose();
    setTimeout(reset, 300);
  }

  function proceedToMethod() {
    const finalAmount = customAmount ? Number(customAmount) : amount;
    if (!Number.isInteger(finalAmount) || finalAmount < 10000 || finalAmount > 5000000) {
      toast.error("Top up minimal Rp 10.000, maksimal Rp 5.000.000");
      return;
    }
    setAmount(finalAmount);
    setStep("method");
  }

  async function createTopup() {
    setCreating(true);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat top-up");
      setResult(data);
      setStep("instruction");
      toast.success("Top-up dibuat. Selesaikan pembayaran sebelum expired.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat top-up");
    } finally {
      setCreating(false);
    }
  }

  async function confirmPayment() {
    if (!result) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/wallet/topup/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          txCode: result.txCode,
          transactionStatus: "settlement",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal konfirmasi top-up");
      setFinalBalance(data.newBalance);
      setStep("success");
      onSuccess?.(data.newBalance);
      toast.success("Top-up berhasil! Saldo bertambah " + formatRupiah(data.amount));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal konfirmasi top-up");
    } finally {
      setConfirming(false);
    }
  }

  function copyVaNumber() {
    if (!result?.vaNumber) return;
    navigator.clipboard.writeText(result.vaNumber);
    setCopied(true);
    toast.success("Nomor VA disalin");
    setTimeout(() => setCopied(false), 2000);
  }

  const expiresInSeconds = result
    ? Math.max(0, Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000))
    : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className={cn("max-w-md accent-" + accent)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-role" />
            Top Up RejoPay
          </DialogTitle>
          <DialogDescription>
            {step === "amount" && "Pilih nominal top-up"}
            {step === "method" && "Pilih metode pembayaran"}
            {step === "instruction" && "Selesaikan pembayaran"}
            {step === "success" && "Top-up berhasil"}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "amount" && (
            <motion.div
              key="amount"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => { setAmount(preset); setCustomAmount(""); }}
                    className={cn(
                      "rounded-2xl border-2 px-3 py-3 text-center transition-premium",
                      amount === preset && !customAmount
                        ? "border-role bg-role/10 text-role"
                        : "border-border hover:border-role/50",
                    )}
                  >
                    <p className="text-sm font-700">{formatRupiah(preset).replace("Rp ", "")}</p>
                  </button>
                ))}
              </div>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                <Input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Nominal lain"
                  className="pl-10"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Min Rp 10.000 • Maks Rp 5.000.000
              </p>

              <Button
                onClick={proceedToMethod}
                className="w-full bg-role text-white hover:opacity-90"
              >
                Lanjut <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {step === "method" && (
            <motion.div
              key="method"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-2"
            >
              <div className="mb-3 rounded-xl bg-muted px-4 py-3">
                <p className="text-xs text-muted-foreground">Nominal Top Up</p>
                <p className="font-display text-xl font-700 text-foreground">{formatRupiah(amount)}</p>
              </div>

              {METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-premium",
                    method === m.value
                      ? "border-role bg-role/5"
                      : "border-border hover:border-role/40",
                  )}
                >
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl",
                    method === m.value ? "bg-role text-white" : "bg-muted text-muted-foreground",
                  )}>
                    {m.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-700">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                  {method === m.value && <CheckCircle2 className="h-4 w-4 text-role" />}
                </button>
              ))}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep("amount")} className="flex-1">
                  Kembali
                </Button>
                <Button
                  onClick={createTopup}
                  disabled={creating}
                  className="flex-1 bg-role text-white hover:opacity-90"
                >
                  {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  Bayar {formatRupiah(amount)}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "instruction" && result && (
            <motion.div
              key="instruction"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Metode</span>
                  <Badge variant="secondary" className="gap-1">
                    {methodIcon(result.method)}
                    {result.methodLabel}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Nominal</span>
                  <span className="font-700">{formatRupiah(result.amount)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Kode Transaksi</span>
                  <span className="font-mono text-xs">{result.txCode}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Expired
                  </span>
                  <span className="text-xs font-600 text-rose-500">
                    {Math.floor(expiresInSeconds / 60)}m {expiresInSeconds % 60}s
                  </span>
                </div>
              </div>

              {result.vaNumber && (
                <div className="rounded-2xl border-2 border-dashed border-role/30 bg-role/5 p-4">
                  <p className="text-xs text-muted-foreground">Nomor Virtual Account</p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="font-mono text-lg font-700 tracking-wider">{result.vaNumber}</p>
                    <button
                      onClick={copyVaNumber}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-role shadow-sm transition-premium hover:scale-105"
                    >
                      {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Transfer tepat sesuai nominal untuk konfirmasi otomatis.
                  </p>
                </div>
              )}

              {result.method === "QRIS" && (
                <div className="rounded-2xl border-2 border-dashed border-role/30 bg-role/5 p-4 text-center">
                  <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-2xl bg-white">
                    <QrCode className="h-24 w-24 text-role" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Scan QR dengan e-wallet atau m-banking apapun.
                  </p>
                </div>
              )}

              {result.method.startsWith("EWALLET_") && (
                <div className="rounded-2xl border-2 border-dashed border-role/30 bg-role/5 p-4 text-center">
                  <p className="text-sm font-600">Bayar via {result.methodLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Buka aplikasi {result.methodLabel}, scan QR atau bayar via deeplink.
                  </p>
                </div>
              )}

              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                💡 Demo mode: klik tombol di bawah untuk simulasi "saya sudah bayar".
                Di production, konfirmasi otomatis via webhook gateway.
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep("method")} className="flex-1">
                  Ganti Metode
                </Button>
                <Button
                  onClick={confirmPayment}
                  disabled={confirming}
                  className="flex-1 bg-role text-white hover:opacity-90"
                >
                  {confirming ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                  Saya Sudah Bayar
                </Button>
              </div>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-4 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
              >
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" strokeWidth={2.5} />
              </motion.div>
              <p className="mt-4 font-display text-lg font-700">Top-up Berhasil!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Saldo RejoPay bertambah
              </p>
              <p className="mt-2 font-display text-2xl font-700 text-role">
                {formatRupiah(result?.amount ?? 0)}
              </p>
              <div className="mt-4 w-full rounded-xl bg-muted p-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Saldo Baru</span>
                  <span className="font-700">{finalBalance !== null ? formatRupiah(finalBalance) : "—"}</span>
                </div>
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Kode Tx</span>
                  <span className="font-mono">{result?.txCode}</span>
                </div>
              </div>
              <Button onClick={handleClose} className="mt-4 w-full bg-role text-white hover:opacity-90">
                Selesai
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
