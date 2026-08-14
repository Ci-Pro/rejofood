"use client";

import { motion } from "framer-motion";
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "saffron" | "lavender" | "mint" | "rose";

interface WalletCardProps {
  balance: number;
  isFrozen?: boolean;
  monthTopup?: number;
  monthSpending?: number;
  monthEarning?: number;
  /** Untuk driver/merchant: tampilkan section earning */
  showEarning?: boolean;
  onTopUp?: () => void;
  onWithdraw?: () => void;
  loading?: boolean;
  /** Role accent — konsisten dengan dashboard lainnya */
  accent?: Accent;
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

export function WalletCard({
  balance,
  isFrozen = false,
  monthTopup = 0,
  monthSpending = 0,
  monthEarning = 0,
  showEarning = false,
  onTopUp,
  onWithdraw,
  loading = false,
  accent = "saffron",
}: WalletCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "accent-" + accent,
        "relative overflow-hidden rounded-3xl p-5 sm:p-6 shadow-premium text-white",
      )}
    >
      {/* Background — RejoFood deep teal */}
      <div className="pointer-events-none absolute inset-0 bg-role" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(135deg, rgba(255,107,34,0.15) 0%, rgba(0,0,0,0.15) 100%)" }}
        aria-hidden
      />
      {/* Orange glow accent */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20 blur-3xl" style={{ background: "#FF6B22" }} />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Wallet className="h-5 w-5" strokeWidth={2.3} />
            </div>
            <div>
              <p className="text-[0.65rem] font-700 uppercase tracking-wider text-white/70">
                RejoPay
              </p>
              <p className="text-xs font-500 text-white/80">Dompet Digital</p>
            </div>
          </div>
          {isFrozen && (
            <div className="flex items-center gap-1.5 rounded-full bg-rose-500/30 px-2.5 py-1 backdrop-blur">
              <Snowflake className="h-3.5 w-3.5" />
              <span className="text-[0.65rem] font-700 uppercase tracking-wider">Dibekukan</span>
            </div>
          )}
        </div>

        {/* Balance */}
        <div className="mt-6">
          <p className="text-[0.7rem] font-500 uppercase tracking-wider text-white/70">
            Saldo Tersedia
          </p>
          <motion.p
            key={balance}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-1 font-display text-3xl font-700 tracking-tight sm:text-4xl"
          >
            {loading ? "···" : formatRupiah(balance)}
          </motion.p>
        </div>

        {/* Actions */}
        <div className="mt-5 flex gap-2">
          <button
            onClick={onTopUp}
            disabled={isFrozen || loading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white py-2.5 text-sm font-700 text-primary shadow-premium transition-premium hover:bg-white/95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Top Up
          </button>
          {showEarning && (
            <button
              onClick={onWithdraw}
              disabled={isFrozen || loading || balance < 50000}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white/15 py-2.5 text-sm font-700 text-white backdrop-blur transition-premium hover:bg-white/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
              Tarik
            </button>
          )}
        </div>

        {/* Monthly stats */}
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-4">
          <div>
            <div className="flex items-center gap-1 text-white/70">
              <ArrowDownLeft className="h-3 w-3" />
              <span className="text-[0.6rem] font-600 uppercase tracking-wider">Top Up</span>
            </div>
            <p className="mt-0.5 text-sm font-700">{formatRupiah(monthTopup)}</p>
            <p className="text-[0.6rem] text-white/60">bulan ini</p>
          </div>
          {showEarning ? (
            <div>
              <div className="flex items-center gap-1 text-white/70">
                <ArrowDownLeft className="h-3 w-3" />
                <span className="text-[0.6rem] font-600 uppercase tracking-wider">Earning</span>
              </div>
              <p className="mt-0.5 text-sm font-700">{formatRupiah(monthEarning)}</p>
              <p className="text-[0.6rem] text-white/60">bulan ini</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1 text-white/70">
                <ArrowUpRight className="h-3 w-3" />
                <span className="text-[0.6rem] font-600 uppercase tracking-wider">Keluar</span>
              </div>
              <p className="mt-0.5 text-sm font-700">{formatRupiah(monthSpending)}</p>
              <p className="text-[0.6rem] text-white/60">bulan ini</p>
            </div>
          )}
          <div>
            <div className="flex items-center gap-1 text-white/70">
              <Wallet className="h-3 w-3" />
              <span className="text-[0.6rem] font-600 uppercase tracking-wider">Total Tx</span>
            </div>
            <p className="mt-0.5 text-sm font-700">—</p>
            <p className="text-[0.6rem] text-white/60">lifetime</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
