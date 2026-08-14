"use client";

import { motion } from "framer-motion";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { BrandLogo } from "@/components/auth/brand-logo";
import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F8F9FB 100%)" }}
      />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-8">
        <div className="mb-6">
          <BrandLogo size="md" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center text-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-rose/10">
            <AlertCircle className="h-9 w-9 text-rose" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-700 text-foreground">Terjadi kesalahan</h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Maaf, terjadi error di server. Coba muat ulang halaman ini.
          </p>
          <div className="mt-6 flex gap-2">
            <Button onClick={reset} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <RefreshCw className="h-4 w-4" /> Coba lagi
            </Button>
            <Button variant="outline" onClick={() => window.location.href = "/"}>
              <Home className="h-4 w-4" /> Beranda
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
