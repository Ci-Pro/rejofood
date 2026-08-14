"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Eye, EyeOff, LogIn, AlertCircle, Lock, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/auth/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import { TwoFactorSetup } from "@/components/auth/twofactor-setup";
import { TwoFactorChallenge } from "@/components/auth/twofactor-challenge";

export default function AdminLoginPage() {
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slowLogin, setSlowLogin] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string; remainingAttempts?: number } | null>(null);
  const [lockCountdown, setLockCountdown] = useState(0);

  // 2FA flow
  const [twoFactorMode, setTwoFactorMode] = useState<null | "setup" | "challenge">(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeName, setChallengeName] = useState<string>("");

  // Check if already logged in as admin
  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.role === "ADMIN") {
          window.location.href = "/";
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (lockCountdown <= 0) return;
    const t = setInterval(() => setLockCountdown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockCountdown]);

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}d`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}d` : `${m}m`;
  }

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockCountdown > 0) return;
    setError(null);
    setSlowLogin(false);
    setLoading(true);
    const slowTimer = setTimeout(() => setSlowLogin(true), 2000);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, expectedRole: "ADMIN" }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err = { message: data?.error || "Gagal masuk.", code: data?.code, remainingAttempts: data?.remainingAttempts };
        setError(err);
        if (data?.code === "LOCKED_OUT" && typeof data.retryAfterSeconds === "number") {
          setLockCountdown(data.retryAfterSeconds);
        }
        return;
      }

      if (data.needsSetup && data.challengeToken) {
        setChallengeToken(data.challengeToken);
        setChallengeName(data.fullName || "");
        setTwoFactorMode("setup");
        return;
      }
      if (data.needsTwoFactor && data.challengeToken) {
        setChallengeToken(data.challengeToken);
        setChallengeName(data.fullName || "");
        setTwoFactorMode("challenge");
        return;
      }

      setUser(data.user);
      toast.success(`Selamat datang, ${data.user.fullName}!`);
      window.location.href = "/";
    } catch {
      setError({ message: "Koneksi bermasalah. Periksa internet Anda." });
    } finally {
      clearTimeout(slowTimer);
      setSlowLogin(false);
      setLoading(false);
    }
  }, [email, password, lockCountdown, setUser]);

  function cancelTwoFactor() {
    setTwoFactorMode(null);
    setChallengeToken(null);
    setChallengeName("");
    setPassword("");
    setError(null);
  }

  const isLocked = lockCountdown > 0;

  if (twoFactorMode === "setup" && challengeToken) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-background">
        <div className="pointer-events-none fixed inset-0" style={{ background: "linear-gradient(180deg, #FFF8EE 0%, #FFFFFF 100%)" }} />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-8">
          <div className="w-full max-w-md">
            <div className="mb-6 flex justify-center"><BrandLogo size="md" /></div>
            <TwoFactorSetup challengeToken={challengeToken} fullName={challengeName} onCancel={cancelTwoFactor} />
          </div>
        </div>
      </div>
    );
  }

  if (twoFactorMode === "challenge" && challengeToken) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-background">
        <div className="pointer-events-none fixed inset-0" style={{ background: "linear-gradient(180deg, #FFF8EE 0%, #FFFFFF 100%)" }} />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-8">
          <div className="w-full max-w-md">
            <div className="mb-6 flex justify-center"><BrandLogo size="md" /></div>
            <TwoFactorChallenge challengeToken={challengeToken} fullName={challengeName} onCancel={cancelTwoFactor} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <div className="pointer-events-none fixed inset-0" style={{ background: "linear-gradient(180deg, #FFF8EE 0%, #FFFFFF 100%)" }} />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-8">
        <div className="mb-6">
          <BrandLogo size="lg" />
        </div>

        {/* Admin-only badge */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2"
        >
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-xs font-700 uppercase tracking-wider text-primary">Panel Admin</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-premium sm:p-8"
        >
          <div className="mb-6">
            <h2 className="font-display text-xl font-700 text-foreground">Masuk sebagai Admin</h2>
            <p className="mt-1 text-sm text-muted-foreground">Akses terbatas. Verifikasi 2 lapis wajib.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">Email Admin</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@rejofood.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLocked}
                className="h-11 rounded-xl bg-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">Password</Label>
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
                  className="h-11 rounded-xl bg-input pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  disabled={isLocked}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPwd ? "Sembunyikan" : "Tampilkan"}
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
                    isLocked ? "border-primary/30 bg-primary/5 text-primary" : "border-destructive/30 bg-destructive/5 text-destructive",
                  )}
                >
                  {isLocked ? <Lock className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <div className="flex-1">
                    <span>{error.message}</span>
                    {!isLocked && typeof error.remainingAttempts === "number" && error.remainingAttempts > 0 && (
                      <span className="mt-1 block text-xs opacity-80">
                        Sisa percobaan: {error.remainingAttempts} dari 5.
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {slowLogin && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-muted p-2 text-xs text-muted-foreground"
              >
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Jaringan lambat — mohon tunggu sebentar…
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={loading || isLocked}
              className="h-11 w-full rounded-xl bg-primary text-primary-foreground transition-premium hover:bg-primary/90 active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {slowLogin ? "Memproses… (jaringan lambat)" : "Memproses…"}
                </span>
              ) : isLocked ? (
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Dikunci · {formatDuration(lockCountdown)}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" /> Masuk
                </span>
              )}
            </Button>
          </form>
        </motion.div>

        <p className="mt-6 text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} RejoFood · Admin Panel
        </p>
      </div>
    </div>
  );
}

// Need cn import
import { cn } from "@/lib/utils";
