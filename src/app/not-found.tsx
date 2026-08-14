"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Home, UtensilsCrossed } from "lucide-react";
import { BrandLogo } from "@/components/auth/brand-logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
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
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary">
            <UtensilsCrossed className="h-9 w-9 text-muted-foreground" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-700 text-foreground">Halaman tidak ditemukan</h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Maaf, halaman yang Anda cari tidak ada atau sudah dipindahkan.
          </p>
          <Link href="/" className="mt-6 w-full max-w-xs">
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Home className="h-4 w-4" /> Kembali ke Beranda
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
