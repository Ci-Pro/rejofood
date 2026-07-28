"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, QrCode, Copy, Check, AlertCircle, KeyRound, RefreshCw } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SetupData {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
  email: string;
}

export function TwoFactorSetup({
  challengeToken,
  fullName,
  onCancel,
}: {
  challengeToken: string;
  fullName: string;
  onCancel: () => void;
}) {
  const setUser = useAuthStore((s) => s.setUser);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch QR + secret on mount
  const fetchSetup = useCallback(async () => {
    setLoadingSetup(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal memuat setup 2FA.");
        return;
      }
      setSetupData(data);
    } catch {
      setError("Koneksi bermasalah.");
    } finally {
      setLoadingSetup(false);
    }
  }, [challengeToken]);

  useEffect(() => {
    fetchSetup();
  }, [fetchSetup]);

  async function copySecret() {
    if (!setupData) return;
    await navigator.clipboard.writeText(setupData.secret);
    setCopied(true);
    toast.success("Secret disalin ke clipboard.");
    setTimeout(() => setCopied(false), 2000);
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeToken, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Verifikasi gagal.");
        if (data?.code === "CHALLENGE_EXHAUSTED") {
          // Challenge exhausted — must restart login
          setTimeout(() => onCancel(), 2000);
        }
        setCode("");
        return;
      }
      setUser(data.user);
      toast.success(`2FA aktif! Selamat datang, ${data.user.fullName}.`);
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
      <div className="mb-5 flex items-center gap-2">
        <span className="accent-rose inline-flex h-9 w-9 items-center justify-center rounded-xl bg-role text-role-fg">
          <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2.2} />
        </span>
        <div>
          <h2 className="font-display text-xl font-700 leading-tight text-foreground">
            Aktifkan 2FA Admin
          </h2>
          <p className="text-xs text-muted-foreground">Wajib untuk akun admin · {fullName}</p>
        </div>
      </div>

      {loadingSetup && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Menyiapkan QR code…
        </div>
      )}

      {setupData && (
        <div className="space-y-4">
          <ol className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <span className="accent-rose flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-role-soft text-[0.6rem] font-700 text-rose">1</span>
              Scan QR dengan Google Authenticator / Authy / 1Password
            </li>
            <li className="flex gap-2">
              <span className="accent-rose flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-role-soft text-[0.6rem] font-700 text-rose">2</span>
              Masukkan 6-digit code dari app
            </li>
            <li className="flex gap-2">
              <span className="accent-rose flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-role-soft text-[0.6rem] font-700 text-rose">3</span>
              Simpan secret ini sebagai backup (lihat di bawah)
            </li>
          </ol>

          {/* QR card */}
          <div className="accent-rose flex items-center gap-4 rounded-2xl border border-role/30 bg-role-soft/30 p-4">
            <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
              <img src={setupData.qrDataUrl} alt="QR code for 2FA" width={120} height={120} />
            </div>
            <div className="flex-1 space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs font-700 uppercase tracking-wide text-rose">
                <QrCode className="h-3.5 w-3.5" /> Scan dengan Authenticator
              </p>
              <p className="text-[0.7rem] text-muted-foreground">
                App: Google Authenticator, Authy, 1Password, Bitwarden, dll.
              </p>
              <p className="text-[0.7rem] text-muted-foreground">
                Akun: <span className="font-600 text-foreground">{setupData.email}</span>
              </p>
            </div>
          </div>

          {/* Secret + copy button (manual entry fallback) */}
          <details className="rounded-xl border border-border bg-card p-3 text-xs">
            <summary className="cursor-pointer font-600 text-muted-foreground hover:text-foreground">
              Tidak bisa scan? Klik untuk lihat secret manual
            </summary>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg bg-muted px-2 py-1.5 font-mono text-[0.7rem]">
                {setupData.secret}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={copySecret}
                className="h-8 px-2"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="mt-1.5 text-[0.65rem] text-muted-foreground">
              ⚠️ Simpan secret ini di tempat aman. Jika HP hilang, ini satu-satunya cara recovery (TODO: backup codes).
            </p>
          </details>

          {/* OTP input */}
          <form onSubmit={onVerify} className="space-y-3">
            <label className="block text-center text-xs font-600 uppercase tracking-wide text-muted-foreground">
              Masukkan 6-digit code
            </label>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => setCode(v)}
                disabled={verifying}
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
                  Aktifkan & Masuk
                </span>
              )}
            </Button>
          </form>
        </div>
      )}

      {error && !setupData && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchSetup} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" /> Coba lagi
            </Button>
            <Button variant="ghost" onClick={onCancel} className="flex-1">
              Kembali ke login
            </Button>
          </div>
        </div>
      )}

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
