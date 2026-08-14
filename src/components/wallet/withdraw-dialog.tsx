"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote, Loader2, CheckCircle2, ArrowRight, Building2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PinVerifyDialog } from "./pin-verify-dialog";

interface WithdrawDialogProps {
  open: boolean;
  onClose: () => void;
  currentBalance: number;
  /** Jika user sudah set PIN, withdraw butuh verifikasi */
  hasPin?: boolean;
  onSuccess?: (amount: number) => void;
}

const BANKS = [
  { code: "BCA", name: "Bank BCA" },
  { code: "BNI", name: "Bank BNI" },
  { code: "MANDIRI", name: "Bank Mandiri" },
  { code: "BRI", name: "Bank BRI" },
  { code: "PERMATA", name: "Bank Permata" },
];

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

export function WithdrawDialog({ open, onClose, currentBalance, hasPin = false, onSuccess }: WithdrawDialogProps) {
  const [amount, setAmount] = useState<string>("");
  const [bankCode, setBankCode] = useState<string>("BCA");
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [accountName, setAccountName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ amount: number; txCode: string } | null>(null);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);

  function reset() {
    setAmount("");
    setBankCode("BCA");
    setAccountNumber("");
    setAccountName("");
    setSuccess(null);
    setPinPromptOpen(false);
  }

  function handleClose() {
    onClose();
    setTimeout(reset, 300);
  }

  // Validate form fields sebelum show PIN prompt atau submit
  function validateForm(): boolean {
    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt < 50000) {
      toast.error("Minimal withdraw Rp 50.000");
      return false;
    }
    if (amt > currentBalance) {
      toast.error("Saldo tidak cukup");
      return false;
    }
    if (!accountNumber || accountNumber.length < 6) {
      toast.error("Nomor rekening tidak valid (min 6 digit)");
      return false;
    }
    if (!accountName.trim()) {
      toast.error("Nama pemilik rekening wajib diisi");
      return false;
    }
    return true;
  }

  function handleSubmitClick() {
    if (!validateForm()) return;
    if (hasPin) {
      // Show PIN dialog dulu
      setPinPromptOpen(true);
    } else {
      // Langsung submit
      submit();
    }
  }

  async function submit() {
    const amt = Number(amount);
    setSubmitting(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          bankCode,
          accountNumber,
          accountName: accountName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal withdraw");
      setSuccess({ amount: amt, txCode: data.txCode });
      onSuccess?.(amt);
      toast.success("Withdraw dikirim. Dana masuk dalam 1×24 jam.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal withdraw");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-[#7C5BBF]" />
            Tarik Saldo
          </DialogTitle>
          <DialogDescription>
            Tarik saldo RejoPay ke rekening bank Anda
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {!success ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Saldo Tersedia</p>
                <p className="font-display text-xl font-700">{formatRupiah(currentBalance)}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wd-amount">Nominal Withdraw</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                  <Input
                    id="wd-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="50000"
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  {[50000, 100000, 250000, 500000].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setAmount(String(preset))}
                      className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-600 hover:border-[#7C5BBF]/40"
                    >
                      {preset >= 1000 ? `${preset / 1000}k` : preset}
                    </button>
                  ))}
                  <button
                    onClick={() => setAmount(String(currentBalance))}
                    className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-600 hover:border-[#7C5BBF]/40"
                  >
                    Maks
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bank Tujuan</Label>
                <Select value={bankCode} onValueChange={setBankCode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((b) => (
                      <SelectItem key={b.code} value={b.code}>
                        <span className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5" />
                          {b.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wd-account">Nomor Rekening</Label>
                <Input
                  id="wd-account"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="1234567890"
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wd-name">Nama Pemilik Rekening</Label>
                <Input
                  id="wd-name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Nama sesuai buku tabungan"
                />
              </div>

              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                ⚠️ Minimal withdraw Rp 50.000. Dana masuk dalam 1×24 jam kerja.
                Pastikan nomor rekening benar — saldo tidak bisa dikembalikan jika salah transfer.
              </div>

              <Button
                onClick={handleSubmitClick}
                disabled={submitting}
                className="w-full bg-[#7C5BBF] text-white hover:bg-[#6B4FB5]"
              >
                {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Tarik {amount ? formatRupiah(Number(amount)) : "Saldo"}
              </Button>
            </motion.div>
          ) : (
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
              <p className="mt-4 font-display text-lg font-700">Withdraw Diproses!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatRupiah(success.amount)} akan ditransfer ke rekening Anda
              </p>
              <div className="mt-4 w-full rounded-xl bg-muted p-3 text-left">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Kode Transaksi</span>
                  <span className="font-mono">{success.txCode}</span>
                </div>
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Estimasi Selesai</span>
                  <span className="font-600">1×24 jam</span>
                </div>
              </div>
              <Button onClick={handleClose} className="mt-4 w-full bg-[#7C5BBF] text-white hover:bg-[#6B4FB5]">
                Selesai
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>

      {/* PIN verification dialog (modal on top of modal) */}
      <PinVerifyDialog
        open={pinPromptOpen}
        onClose={() => setPinPromptOpen(false)}
        context={`Withdraw ${formatRupiah(Number(amount))} ke ${bankCode}`}
        onVerified={() => {
          setPinPromptOpen(false);
          submit();
        }}
      />
    </Dialog>
  );
}
