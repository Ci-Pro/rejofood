"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, AlertCircle, ShieldCheck } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";

export function TwoFactorChallenge({
  challengeToken,
  fullName,
  onCancel,
}: {
  challengeToken: string;
  fullName: string;
  onCancel: () => void;
}) {
  const setUser = useAuthStore((s) => s.setUser);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeToken, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Verifikasi gagal.");
        if (data?.code === "CHALLENGE_EXHAUSTED") {
          setTimeout(() => onCancel(), 2000);
        }
        setCode("");
        return;
      }
      setUser(data.user);
      toast.success(`Selamat datang, ${data.user.fullName}!`);
    } catch {
      setError("Koneksi bermasalah.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-full"
    >
      <div className="mb-6 flex items-center gap-2">
        <span className="accent-rose inline-flex h-9 w-9 items-center justify-center rounded-xl bg-role text-role-fg">
          <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2.2} />
        </span>
        <div>
          <h2 className="font-display text-xl font-700 leading-tight text-foreground">
            Verifikasi 2FA
          </h2>
          <p className="text-xs text-muted-foreground">
            Masukkan kode dari authenticator app · {fullName}
          </p>
        </div>
      </div>

      <form onSubmit={onVerify} className="space-y-4">
        <label className="block text-center text-xs font-600 uppercase tracking-wide text-muted-foreground">
          Kode 6-digit
        </label>
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(v) => setCode(v)}
            disabled={verifying}
            autoFocus
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} className="h-12 w-12 text-base" />
              <InputOTPSlot index={1} className="h-12 w-12 text-base" />
              <InputOTPSlot index={2} className="h-12 w-12 text-base" />
              <InputOTPSlot index={3} className="h-12 w-12 text-base" />
              <InputOTPSlot index={4} className="h-12 w-12 text-base" />
              <InputOTPSlot index={5} className="h-12 w-12 text-base" />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          type="submit"
          disabled={verifying || code.length !== 6}
          className="accent-rose h-11 w-full rounded-xl bg-role text-role-fg hover:opacity-90"
        >
          {verifying ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Verifikasi…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Verifikasi & Masuk
            </span>
          )}
        </Button>
      </form>

      <button
        type="button"
        onClick={onCancel}
        className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        ← Kembali ke login
      </button>
    </motion.div>
  );
}
