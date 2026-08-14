"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { BrandLogo } from "@/components/auth/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

type Status = "form" | "loading" | "success" | "error";

export default function SetupAdminPage() {
  const [setupKey, setSetupKey] = useState("");
  const [status, setStatus] = useState<Status>("form");
  const [result, setResult] = useState<{ message?: string; loginUrl?: string } | null>(null);

  async function setup() {
    if (!setupKey.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/setup/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ setupKey: setupKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setResult({ message: data.error || "Gagal setup admin." });
        return;
      }
      setStatus("success");
      setResult(data);
    } catch {
      setStatus("error");
      setResult({ message: "Koneksi bermasalah." });
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F8F9FB 100%)" }}
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-8">
        <div className="mb-6">
          <BrandLogo size="lg" />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-premium"
        >
          {status === "success" ? (
            <div className="flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100"
              >
                <CheckCircle2 className="h-9 w-9 text-green-600" strokeWidth={2.5} />
              </motion.div>
              <h2 className="mt-4 font-display text-xl font-700">Admin Siap!</h2>
              <p className="mt-2 text-sm text-muted-foreground">{result?.message}</p>

              <div className="mt-6 w-full space-y-2 rounded-xl bg-muted/50 p-4 text-left text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-mono font-700">rejofood@admin.com</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Password</span>
                  <span className="font-mono font-700">rejofood@99</span>
                </div>
              </div>

              <Link href="/?admin=1" className="mt-6 w-full">
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Login Admin
                </Button>
              </Link>
            </div>
          ) : status === "error" ? (
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
                <XCircle className="h-9 w-9 text-rose-500" strokeWidth={2.5} />
              </div>
              <h2 className="mt-4 font-display text-xl font-700">Gagal</h2>
              <p className="mt-2 text-sm text-muted-foreground">{result?.message}</p>
              <Button
                onClick={() => { setStatus("form"); setResult(null); }}
                variant="outline"
                className="mt-6 w-full"
              >
                Coba lagi
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-display text-lg font-700">Setup Admin</h1>
                  <p className="text-xs text-muted-foreground">Bootstrap admin user untuk production</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="setupKey" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                    Setup Key
                  </Label>
                  <Input
                    id="setupKey"
                    type="password"
                    value={setupKey}
                    onChange={(e) => setSetupKey(e.target.value)}
                    placeholder="Masukkan setup key"
                    className="h-11"
                    onKeyDown={(e) => e.key === "Enter" && setupKey.trim() && setup()}
                  />
                  <p className="text-xs text-muted-foreground">
                    Default key: <code className="rounded bg-muted px-1 py-0.5 text-[0.65rem]">rejofood-setup-2026</code>
                  </p>
                </div>

                <Button
                  onClick={setup}
                  disabled={status === "loading" || !setupKey.trim()}
                  className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {status === "loading" ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Setup…</>
                  ) : (
                    "Setup Admin"
                  )}
                </Button>

                <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
                  <p className="font-700">Admin yang akan dibuat:</p>
                  <p className="mt-1">Email: rejofood@admin.com</p>
                  <p>Password: rejofood@99</p>
                  <p className="mt-2 text-amber-600">Setelah login, wajib setup 2FA TOTP.</p>
                </div>
              </div>
            </>
          )}
        </motion.div>

        <p className="mt-6 text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} RejoFood · Setup Admin
        </p>
      </div>
    </div>
  );
}
