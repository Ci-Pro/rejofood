"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Receipt, ShieldCheck, ShieldAlert } from "lucide-react";
import { WalletCard } from "./wallet-card";
import { TopUpDialog } from "./topup-dialog";
import { WithdrawDialog } from "./withdraw-dialog";
import { WalletTransactionsList } from "./wallet-transactions-list";
import { PinSetDialog } from "./pin-set-dialog";
import { Button } from "@/components/ui/button";

interface WalletData {
  wallet: {
    id: string;
    balance: number;
    isFrozen: boolean;
    hasPin: boolean;
    createdAt: string;
  };
  summary: {
    monthTopup: number;
    monthSpending: number;
    monthEarning: number;
    txCount: number;
  };
  recent: Array<{
    id: string;
    code: string;
    type: string;
    status: string;
    amount: number;
    description: string;
    createdAt: string;
  }>;
}

interface WalletPanelProps {
  /** Untuk driver/merchant: tampilkan tombol withdraw */
  showWithdraw?: boolean;
}

export function WalletPanel({ showWithdraw = false }: WalletPanelProps) {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [pinSetOpen, setPinSetOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (err) {
      console.error("[wallet] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hasPin = data?.wallet?.hasPin ?? false;

  return (
    <div className="space-y-5">
      <WalletCard
        balance={data?.wallet?.balance ?? 0}
        isFrozen={data?.wallet?.isFrozen ?? false}
        monthTopup={data?.summary?.monthTopup ?? 0}
        monthSpending={data?.summary?.monthSpending ?? 0}
        monthEarning={data?.summary?.monthEarning ?? 0}
        showEarning={showWithdraw}
        onTopUp={() => setTopUpOpen(true)}
        onWithdraw={() => setWithdrawOpen(true)}
        loading={loading}
      />

      {/* PIN status banner */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={hasPin
            ? "flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30"
            : "flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30"}
        >
          <div className={hasPin
            ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300"
            : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300"}>
            {hasPin
              ? <ShieldCheck className="h-4 w-4" />
              : <ShieldAlert className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className={hasPin
              ? "text-sm font-700 text-emerald-700 dark:text-emerald-300"
              : "text-sm font-700 text-amber-700 dark:text-amber-300"}>
              {hasPin ? "PIN Aktif" : "PIN Belum Di-set"}
            </p>
            <p className={hasPin
              ? "text-xs text-emerald-600 dark:text-emerald-400"
              : "text-xs text-amber-600 dark:text-amber-400"}>
              {hasPin
                ? "Transaksi di atas Rp 100.000 & withdrawal dilindungi PIN."
                : "Aktifkan PIN untuk keamanan transaksi dompet."}
            </p>
          </div>
          {!hasPin && (
            <Button
              size="sm"
              onClick={() => setPinSetOpen(true)}
              className="shrink-0 bg-amber-600 text-white hover:bg-amber-700"
            >
              Set PIN
            </Button>
          )}
        </motion.div>
      )}

      {data?.wallet?.isFrozen && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/30"
        >
          <p className="text-sm font-700 text-rose-700 dark:text-rose-300">
            Dompet Dibekukan
          </p>
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
            Dompet Anda dibekukan oleh admin. Top up, pembayaran, dan withdraw
            dinonaktifkan sementara. Hubungi support@rejofood.id untuk informasi.
          </p>
        </motion.div>
      )}

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display text-base font-700">Riwayat Transaksi</h3>
        </div>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <WalletTransactionsList />
        )}
      </div>

      <TopUpDialog
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        onSuccess={() => load()}
      />

      {showWithdraw && (
        <WithdrawDialog
          open={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
          currentBalance={data?.wallet?.balance ?? 0}
          hasPin={hasPin}
          onSuccess={() => load()}
        />
      )}

      <PinSetDialog
        open={pinSetOpen}
        onClose={() => setPinSetOpen(false)}
        onSuccess={() => load()}
      />
    </div>
  );
}
