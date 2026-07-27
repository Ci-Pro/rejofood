"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, LogIn, AlertCircle, Sparkles } from "lucide-react";
import { Role, ROLES } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, expectedRole: role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal masuk. Coba lagi.");
        return;
      }
      setUser(data.user);
      toast.success(`Selamat datang, ${data.user.fullName}!`);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setEmail(meta.demoEmail);
    setPassword("rejo1234");
    setError(null);
  }

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
            className="h-11 rounded-xl bg-card"
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
              className="h-11 rounded-xl bg-card pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
              className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          type="submit"
          disabled={loading}
          className={cn("accent-" + meta.accent, "h-11 w-full rounded-xl bg-role text-role-fg hover:opacity-90")}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Memproses…
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
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2.5 text-xs font-500 text-muted-foreground hover:border-role hover:text-role"
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
