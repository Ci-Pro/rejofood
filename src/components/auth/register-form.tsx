"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, UserPlus, AlertCircle, ArrowLeft } from "lucide-react";
import { Role, ROLES } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function RegisterForm({
  role,
  onSwitchToLogin,
}: {
  role: Role;
  onSwitchToLogin: () => void;
}) {
  const meta = ROLES[role];
  const setUser = useAuthStore((s) => s.setUser);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");
  const [vehicleType, setVehicleType] = useState<"motorcycle" | "car" | "bicycle">("motorcycle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slowRegister, setSlowRegister] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSlowRegister(false);
    setLoading(true);

    // Slow network detection
    const slowTimer = setTimeout(() => setSlowRegister(true), 2000);

    try {
      const body: Record<string, unknown> = {
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        role,
      };
      if (role === Role.MERCHANT) body.restaurantName = restaurantName.trim() || undefined;
      if (role === Role.DRIVER) body.vehicleType = vehicleType;

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal mendaftar. Coba lagi.");
        return;
      }
      setUser(data.user);
      // Tampilkan info email verification jika dikirim
      if (data.emailVerificationSent) {
        toast.success(`Akun dibuat! Cek email untuk verifikasi.`);
      } else {
        toast.success(`Akun ${meta.label} berhasil dibuat!`);
      }
    } catch {
      setError("Koneksi bermasalah. Periksa internet Anda.");
    } finally {
      clearTimeout(slowTimer);
      setSlowRegister(false);
      setLoading(false);
    }
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
      <button
        type="button"
        onClick={onSwitchToLogin}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-600 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke login
      </button>

      <div className="mb-6 flex items-center gap-2">
        <span className={cn("accent-" + meta.accent, "inline-flex h-9 w-9 items-center justify-center rounded-xl bg-role text-role-fg")}>
          <meta.icon className="h-4.5 w-4.5" strokeWidth={2.2} />
        </span>
        <div>
          <h2 className="font-display text-2xl font-700 leading-tight text-foreground">
            Daftar sebagai <span className={cn("accent-" + meta.accent, "text-role")}>{meta.label}</span>
          </h2>
          <p className="text-sm text-muted-foreground">Buat akun baru — gratis selamanya.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
            Nama lengkap
          </Label>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder="Nama kamu"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="h-11 rounded-xl bg-card"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <Label htmlFor="phone" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
              No. HP <span className="text-muted-foreground/70">(opsional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+62…"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 rounded-xl bg-card"
            />
          </div>
        </div>

        {role === Role.MERCHANT && (
          <div className="space-y-1.5">
            <Label htmlFor="restaurantName" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
              Nama restoran
            </Label>
            <Input
              id="restaurantName"
              type="text"
              placeholder="Warung Rejo Pangan"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              className="h-11 rounded-xl bg-card"
            />
          </div>
        )}

        {role === Role.DRIVER && (
          <div className="space-y-1.5">
            <Label className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
              Jenis kendaraan
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {(["motorcycle", "car", "bicycle"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVehicleType(v)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-600 transition-colors",
                    vehicleType === v
                      ? "border-role bg-role-soft text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-role",
                  )}
                >
                  {v === "motorcycle" ? "Motor" : v === "car" ? "Mobil" : "Sepeda"}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
            Password <span className="text-muted-foreground/70">(min. 6 karakter)</span>
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPwd ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
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
          className={cn(
            "accent-" + meta.accent,
            "h-11 w-full rounded-xl bg-role text-role-fg hover:opacity-90 transition-premium active:scale-[0.98]",
          )}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {slowRegister ? "Mendaftarkan… (jaringan lambat)" : "Mendaftarkan…"}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Buat akun
            </span>
          )}
        </Button>

        {slowRegister && (
          <div className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            Jaringan lambat — mohon tunggu sebentar…
          </div>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-700 text-foreground underline-offset-4 hover:underline"
        >
          Masuk di sini
        </button>
      </p>
    </motion.div>
  );
}
