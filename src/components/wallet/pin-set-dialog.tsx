"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PinSetDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  accent?: "saffron" | "lavender" | "mint" | "rose";
}

type Step = "enter" | "confirm" | "success";

export function PinSetDialog({ open, onClose, onSuccess, accent = "saffron" }: PinSetDialogProps) {
  const [step, setStep] = useState<Step>("enter");
  const [firstPin, setFirstPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset saat dialog tutup
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("enter");
        setFirstPin("");
        setConfirmPin("");
        setError(null);
      }, 200);
    }
  }, [open]);

  // Focus input saat step berubah
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, step]);

  const currentPin = step === "enter" ? firstPin : confirmPin;
  const setCurrentPin = step === "enter" ? setFirstPin : setConfirmPin;

  function handlePinChange(value: string) {
    // Hanya accept 6 digit angka
    const cleaned = value.replace(/\D/g, "").slice(0, 6);
    setCurrentPin(cleaned);
    setError(null);
  }

  async function submit() {
    if (currentPin.length !== 6) {
      setError("PIN harus 6 digit.");
      return;
    }

    if (step === "enter") {
      // Cek PIN lemah di client side
      const weakPins = ["000000", "111111", "222222", "333333", "444444", "555555", "666666", "777777", "888888", "999999", "123456", "654321", "112233", "123123"];
      if (weakPins.includes(currentPin)) {
        setError("PIN terlalu mudah ditebak. Pilih kombinasi yang lebih acak.");
        return;
      }
      setStep("confirm");
      setConfirmPin("");
      return;
    }

    // step === "confirm"
    if (currentPin !== firstPin) {
      setError("PIN tidak cocok. Coba lagi.");
      setConfirmPin("");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/pin/set", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin: firstPin, confirmPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal set PIN");
      setStep("success");
      toast.success("PIN RejoPay berhasil di-set");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal set PIN");
      // Reset ke step enter supaya user input dari awal
      setStep("enter");
      setFirstPin("");
      setConfirmPin("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent className={cn("max-w-sm accent-" + accent)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-role" />
            Set PIN RejoPay
          </DialogTitle>
          <DialogDescription>
            {step === "enter" && "Buat PIN 6 digit untuk mengamankan transaksi dompet."}
            {step === "confirm" && "Masukkan kembali PIN untuk konfirmasi."}
            {step === "success" && "PIN berhasil di-set."}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-6 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
              >
                <CheckCircle2 className="h-9 w-9 text-green-600 dark:text-green-400" strokeWidth={2.5} />
              </motion.div>
              <p className="mt-3 font-display text-base font-700">PIN Aktif!</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Transaksi dompet &gt; Rp 100.000 & semua withdrawal akan butuh PIN.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              <p className="text-center text-sm font-600">
                {step === "enter" ? "Masukkan PIN baru" : "Konfirmasi PIN"}
              </p>

              {/* PIN dots display */}
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-3 w-3 rounded-full transition-colors",
                      i < currentPin.length
                        ? "bg-role"
                        : "bg-muted border border-border",
                    )}
                  />
                ))}
              </div>

              {/* Hidden input untuk keyboard mobile */}
              <Input
                ref={inputRef}
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                value={currentPin}
                onChange={(e) => handlePinChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && currentPin.length === 6) submit();
                }}
                className="absolute opacity-0 pointer-events-none"
                maxLength={6}
              />

              {/* Click area untuk focus input */}
              <button
                type="button"
                onClick={() => inputRef.current?.focus()}
                className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Klik untuk input PIN
              </button>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-xs font-600 text-rose-500"
                >
                  {error}
                </motion.p>
              )}

              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                <p className="font-700">Tips keamanan:</p>
                <ul className="mt-1 space-y-0.5">
                  <li>• Hindari PIN seperti tanggal lahir (DDMMYY)</li>
                  <li>• Jangan pakai 123456 atau 000000</li>
                  <li>• Jangan bagikan PIN ke siapapun</li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {step !== "success" && (
          <DialogFooter>
            {step === "confirm" && (
              <Button
                variant="outline"
                onClick={() => { setStep("enter"); setConfirmPin(""); setError(null); }}
                disabled={loading}
              >
                Kembali
              </Button>
            )}
            <Button
              onClick={submit}
              disabled={loading || currentPin.length !== 6}
              className="bg-role text-white hover:opacity-90"
            >
              {loading
                ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Menyimpan…</>
                : step === "enter"
                  ? "Lanjut"
                  : <><Lock className="mr-1 h-4 w-4" /> Set PIN</>}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
