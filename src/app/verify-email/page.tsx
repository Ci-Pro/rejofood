"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, MailCheck, MailWarning, Send } from "lucide-react";
import { BrandLogo } from "@/components/auth/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";

type Status = "loading" | "success" | "error" | "expired" | "already";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [resendEmail, setResendEmail] = useState<string>("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Token verifikasi tidak ditemukan di URL.");
      return;
    }
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function verify() {
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "EXPIRED") {
          setStatus("expired");
        } else if (data.code === "ALREADY_USED") {
          setStatus("already");
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Verifikasi gagal.");
        }
        return;
      }
      if (data.alreadyVerified) {
        setStatus("already");
      } else {
        setStatus("success");
        toast.success("Email berhasil diverifikasi!");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Koneksi bermasalah. Coba lagi.");
    }
  }

  async function resendVerification() {
    if (!resendEmail.trim()) {
      toast.error("Masukkan email Anda.");
      return;
    }
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: resendEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Link verifikasi baru telah dikirim (jika email terdaftar).");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal kirim ulang.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Background blobs (sama seperti auth-shell) */}
      <div className="pointer-events-none fixed inset-0">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-20 top-1/4 h-72 w-72 rounded-full opacity-20 blur-3xl"
          style={{ background: "#7C5BBF" }}
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-20 bottom-1/4 h-80 w-80 rounded-full opacity-15 blur-3xl"
          style={{ background: "#FF9F1C" }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <BrandLogo size="lg" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass-card w-full max-w-md rounded-3xl border border-border/60 p-8 shadow-premium-lg"
        >
          {status === "loading" && (
            <div className="flex flex-col items-center py-6 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-[#7C5BBF]" />
              <p className="mt-4 font-display text-lg font-700">Memverifikasi email…</p>
              <p className="mt-1 text-sm text-muted-foreground">Mohon tunggu sebentar.</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center py-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
              >
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" strokeWidth={2.5} />
              </motion.div>
              <p className="mt-4 font-display text-xl font-700">Email Terverifikasi!</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Akun Anda sudah aktif. Sekarang Anda bisa login dan mulai menggunakan RejoFood.
              </p>
              <Link href="/" className="mt-6 w-full">
                <Button className="w-full bg-[#7C5BBF] text-white hover:bg-[#6B4FB5]">
                  Masuk ke RejoFood
                </Button>
              </Link>
            </div>
          )}

          {status === "already" && (
            <div className="flex flex-col items-center py-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30"
              >
                <MailCheck className="h-10 w-10 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
              </motion.div>
              <p className="mt-4 font-display text-xl font-700">Email Sudah Diverifikasi</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Email Anda sudah terverifikasi sebelumnya. Silakan langsung login.
              </p>
              <Link href="/" className="mt-6 w-full">
                <Button className="w-full bg-[#7C5BBF] text-white hover:bg-[#6B4FB5]">
                  Masuk ke RejoFood
                </Button>
              </Link>
            </div>
          )}

          {(status === "error" || status === "expired") && (
            <div className="flex flex-col items-center py-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30"
              >
                {status === "expired"
                  ? <MailWarning className="h-10 w-10 text-amber-500" strokeWidth={2.5} />
                  : <XCircle className="h-10 w-10 text-rose-500" strokeWidth={2.5} />}
              </motion.div>
              <p className="mt-4 font-display text-xl font-700">
                {status === "expired" ? "Link Expired" : "Verifikasi Gagal"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {status === "expired"
                  ? "Link verifikasi sudah kedaluwarsa (berlaku 24 jam). Minta link baru di bawah."
                  : errorMessage || "Token tidak valid."}
              </p>

              {status === "expired" && (
                <div className="mt-6 w-full space-y-3 text-left">
                  <Label htmlFor="resend-email" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                    Email Anda
                  </Label>
                  <Input
                    id="resend-email"
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="kamu@email.com"
                    className="h-11 rounded-xl bg-card"
                  />
                  <Button
                    onClick={resendVerification}
                    disabled={resending || !resendEmail.trim()}
                    className="w-full bg-[#7C5BBF] text-white hover:bg-[#6B4FB5]"
                  >
                    {resending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengirim…</>
                    ) : (
                      <><Send className="mr-2 h-4 w-4" /> Kirim Link Baru</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </motion.div>

        <p className="mt-6 text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} RejoFood · v3.0
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
