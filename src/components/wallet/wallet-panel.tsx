"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Receipt } from "lucide-react";
import { WalletCard } from "./wallet-card";
import { TopUpDialog } from "./topup-dialog";
import { WithdrawDialog } from "./withdraw-dialog";
import { WalletTransactionsList } from "./wallet-transactions-list";

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
          onSuccess={() => load()}
        />
      )}
    </div>
  );
}
