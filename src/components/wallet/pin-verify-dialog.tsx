"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PinVerifyDialogProps {
  open: boolean;
  onClose: () => void;
  /** Context: untuk apa PIN ini? Mis. "Bayar order RF-XXX", "Withdraw Rp 50.000" */
  context: string;
  /** Callback setelah PIN berhasil diverifikasi */
  onVerified: () => void;
  accent?: "saffron" | "lavender" | "mint" | "rose";
}

export function PinVerifyDialog({ open, onClose, context, onVerified, accent = "saffron" }: PinVerifyDialogProps) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
      setLocked(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  function handlePinChange(value: string) {
    const cleaned = value.replace(/\D/g, "").slice(0, 6);
    setPin(cleaned);
    setError(null);
  }

  async function verify() {
    if (pin.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/pin/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.valid) {
        toast.success("PIN benar");
        onVerified();
        onClose();
        return;
      }
      if (data.locked) {
        setLocked(data.retryAfterSeconds);
        setError(`PIN terkunci. Coba lagi dalam ${data.retryAfterSeconds} detik.`);
      } else if (data.remaining !== undefined) {
        setError(`PIN salah. Sisa percobaan: ${data.remaining}/${data.maxAttempts}.`);
      } else {
        setError(data.message || "PIN salah.");
      }
      setPin("");
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent className={cn("max-w-sm accent-" + accent)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-role" />
            Masukkan PIN
          </DialogTitle>
          <DialogDescription>{context}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* PIN dots */}
          <div className="flex justify-center gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                animate={error ? { x: [0, -8, 8, -4, 4, 0] } : {}}
                transition={{ duration: 0.4 }}
                className={cn(
                  "h-3 w-3 rounded-full transition-colors",
                  i < pin.length
                    ? "bg-role"
                    : error
                      ? "bg-rose-200 border border-rose-400"
                      : "bg-muted border border-border",
                )}
              />
            ))}
          </div>

          <Input
            ref={inputRef}
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => handlePinChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && pin.length === 6 && !locked) verify();
            }}
            className="absolute opacity-0 pointer-events-none"
            maxLength={6}
            disabled={!!locked}
          />

          <button
            type="button"
            onClick={() => !locked && inputRef.current?.focus()}
            className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {locked ? "PIN terkunci sementara" : "Klik untuk input PIN"}
          </button>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            onClick={verify}
            disabled={loading || pin.length !== 6 || !!locked}
            className="bg-role text-white hover:opacity-90"
          >
            {loading
              ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Verifikasi…</>
              : "Verifikasi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
