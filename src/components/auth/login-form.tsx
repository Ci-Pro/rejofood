"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, LogIn, AlertCircle, Sparkles, Lock, ShieldAlert } from "lucide-react";
import { Role, ROLES } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TwoFactorSetup } from "./twofactor-setup";
import { TwoFactorChallenge } from "./twofactor-challenge";

interface LoginError {
  message: string;
  code?: string;
  remainingAttempts?: number;
  maxAttempts?: number;
  retryAfterSeconds?: number;
  lockedUntil?: number | null;
}

/** Format detik → "Xm Ys" / "Xs" — sinkron dengan format di server. */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}d`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}d` : `${m}m`;
}

export function LoginForm({
  role,
  onSwitchToRegister,
}: {
  role: Role;
  onSwitchToRegister: () => void;
}) {
  const meta = ROLES[role];
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  // Countdown lockout (detik). > 0 = tombol disabled.
  const [lockCountdown, setLockCountdown] = useState(0);

  // 2FA flow state: null = form login biasa, "setup" = first-time admin, "challenge" = admin dgn 2FA
  const [twoFactorMode, setTwoFactorMode] = useState<null | "setup" | "challenge">(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeName, setChallengeName] = useState<string>("");

  // Tick countdown setiap detik
  useEffect(() => {
    if (lockCountdown <= 0) return;
    const t = setInterval(() => {
      setLockCountdown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [lockCountdown]);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockCountdown > 0) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, expectedRole: role }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err: LoginError = {
          message: data?.error || "Gagal masuk. Coba lagi.",
          code: data?.code,
          remainingAttempts: data?.remainingAttempts,
          maxAttempts: data?.maxAttempts,
          retryAfterSeconds: data?.retryAfterSeconds,
          lockedUntil: data?.lockedUntil,
        };
        setError(err);

        // Jika kena lockout, mulai countdown
        if (data?.code === "LOCKED_OUT" && typeof data.retryAfterSeconds === "number") {
          setLockCountdown(data.retryAfterSeconds);
        }
        return;
      }

      // 🔒 2FA: server meminta setup atau verifikasi sebelum login selesai
      if (data.needsSetup && data.challengeToken) {
        setChallengeToken(data.challengeToken);
        setChallengeName(data.fullName || "");
        setTwoFactorMode("setup");
        setError(null);
        return;
      }
      if (data.needsTwoFactor && data.challengeToken) {
        setChallengeToken(data.challengeToken);
        setChallengeName(data.fullName || "");
        setTwoFactorMode("challenge");
        setError(null);
        return;
      }

      setUser(data.user);
      toast.success(`Selamat datang, ${data.user.fullName}!`);
    } catch {
      setError({ message: "Koneksi bermasalah. Coba lagi." });
    } finally {
      setLoading(false);
    }
  }, [email, password, role, lockCountdown, setUser]);

  function fillDemo() {
    setEmail(meta.demoEmail);
    setPassword("rejo1234");
    setError(null);
  }

  function cancelTwoFactor() {
    setTwoFactorMode(null);
    setChallengeToken(null);
    setChallengeName("");
    setPassword("");
    setError(null);
  }

  const isLocked = lockCountdown > 0;
  // Tampilkan warning sisa percobaan hanya jika 1-2 tersisa dan belum locked
  const showLowAttemptsWarning =
    !!error &&
    !isLocked &&
    typeof error.remainingAttempts === "number" &&
    error.remainingAttempts > 0 &&
    error.remainingAttempts <= 2;

  // === 2FA SETUP MODE ===
  if (twoFactorMode === "setup" && challengeToken) {
    return (
      <TwoFactorSetup
        challengeToken={challengeToken}
        fullName={challengeName}
        onCancel={cancelTwoFactor}
      />
    );
  }

  // === 2FA CHALLENGE MODE ===
  if (twoFactorMode === "challenge" && challengeToken) {
    return (
      <TwoFactorChallenge
        challengeToken={challengeToken}
        fullName={challengeName}
        onCancel={cancelTwoFactor}
      />
    );
  }

  // === DEFAULT LOGIN FORM ===

  return (
    <motion.div
      key={role}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-full"
    >
      <div className="mb-6 flex items-center gap-2">
        <span className={cn("accent-" + meta.accent, "inline-flex h-9 w-9 items-center justify-center rounded-xl bg-role text-role-fg")}>
          <meta.icon className="h-4.5 w-4.5" strokeWidth={2.2} />
        </span>
        <div>
          <h2 className="font-display text-2xl font-700 leading-tight text-foreground">
            Masuk sebagai <span className={cn("accent-" + meta.accent, "text-role")}>{meta.label}</span>
          </h2>
          <p className="text-sm text-muted-foreground">{meta.tagline}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="kamu@rejofood.id"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLocked}
            className="h-11 rounded-xl bg-card disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPwd ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLocked}
              className="h-11 rounded-xl bg-card pr-11 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              disabled={isLocked}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label={showPwd ? "Sembunyikan password" : "Tampilkan password"}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                "flex items-start gap-2 rounded-xl border p-3 text-sm",
                isLocked
                  ? "border-rose/30 bg-rose/5 text-rose"
                  : "border-destructive/30 bg-destructive/5 text-destructive",
              )}
            >
              {isLocked ? <Lock className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <div className="flex-1">
                <span>{error.message}</span>
                {!isLocked && typeof error.remainingAttempts === "number" && error.remainingAttempts > 0 && (
                  <span className="mt-1 block text-xs opacity-80">
                    Sisa percobaan: {error.remainingAttempts} dari {error.maxAttempts ?? 5}.
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Warning: percobaan tinggal sedikit, belum locked */}
        <AnimatePresence>
          {showLowAttemptsWarning && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-500"
            >
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Hati-hati. Setelah {error?.maxAttempts ?? 5}× gagal, akun akan dikunci sementara.
                Coba reset password atau gunakan akun demo.
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lockout countdown bar */}
        <AnimatePresence>
          {isLocked && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-xl border border-rose/20 bg-rose/5"
            >
              <div className="flex items-center justify-between px-3 py-2.5 text-xs">
                <span className="flex items-center gap-1.5 font-600 text-rose">
                  <Lock className="h-3.5 w-3.5" />
                  Sementara dikunci
                </span>
                <span className="font-display font-700 text-rose tabular-nums">
                  {formatDuration(lockCountdown)}
                </span>
              </div>
              <div className="h-1 w-full bg-rose/15">
                <motion.div
                  className="h-full bg-rose"
                  initial={{ width: "100%" }}
                  animate={{ width: `${(lockCountdown / (error?.retryAfterSeconds ?? 1)) * 100}%` }}
                  transition={{ ease: "linear", duration: 1 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          type="submit"
          disabled={loading || isLocked}
          className={cn(
            "accent-" + meta.accent,
            "h-11 w-full rounded-xl bg-role text-role-fg hover:opacity-90",
            isLocked && "opacity-50 cursor-not-allowed",
          )}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Memproses…
            </span>
          ) : isLocked ? (
            <span className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Dikunci · {formatDuration(lockCountdown)}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <LogIn className="h-4 w-4" />
              Masuk
            </span>
          )}
        </Button>

        <button
          type="button"
          onClick={fillDemo}
          disabled={isLocked}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2.5 text-xs font-500 text-muted-foreground hover:border-role hover:text-role disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted-foreground"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Isi akun demo ({meta.demoEmail} · rejo1234)
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Belum punya akun?{" "}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="font-700 text-foreground underline-offset-4 hover:underline"
        >
          Daftar sekarang
        </button>
      </p>
    </motion.div>
  );
}
