"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft, ArrowUpRight, Wallet, Clock, Snowflake,
  RotateCcw, Gift, Banknote, RefreshCw, Loader2, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type WalletTxType = "TOPUP" | "PAYMENT" | "REFUND" | "EARNING" | "WITHDRAWAL" | "ADJUSTMENT";
type WalletTxStatus = "PENDING" | "SUCCESS" | "FAILED";

interface WalletTransaction {
  id: string;
  code: string;
  type: WalletTxType;
  status: WalletTxStatus;
  amount: number; // positif atau negatif
  balanceAfter: number;
  description: string;
  orderId: string | null;
  gatewayReference: string | null;
  createdAt: string;
}

interface WalletTransactionsListProps {
  /** Filter by type (null = all) */
  filterType?: WalletTxType | null;
  compact?: boolean;
  accent?: "saffron" | "lavender" | "mint" | "rose";
}

function formatRupiah(n: number): string {
  const sign = n < 0 ? "-" : "+";
  return sign + "Rp " + Math.abs(n).toLocaleString("id-ID");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function txIcon(type: WalletTxType) {
  switch (type) {
    case "TOPUP":
      return <ArrowDownLeft className="h-4 w-4" />;
    case "PAYMENT":
      return <ArrowUpRight className="h-4 w-4" />;
    case "REFUND":
      return <RotateCcw className="h-4 w-4" />;
    case "EARNING":
      return <Gift className="h-4 w-4" />;
    case "WITHDRAWAL":
      return <Banknote className="h-4 w-4" />;
    case "ADJUSTMENT":
      return <Wallet className="h-4 w-4" />;
  }
}

function txColor(type: WalletTxType): string {
  if (type === "TOPUP" || type === "REFUND" || type === "EARNING") return "text-green-600";
  if (type === "PAYMENT" || type === "WITHDRAWAL") return "text-rose-500";
  return "text-amber-500";
}

function txBg(type: WalletTxType): string {
  if (type === "TOPUP" || type === "REFUND" || type === "EARNING") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
  if (type === "PAYMENT" || type === "WITHDRAWAL") return "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
}

function txTypeLabel(type: WalletTxType): string {
  const map: Record<WalletTxType, string> = {
    TOPUP: "Top Up",
    PAYMENT: "Pembayaran",
    REFUND: "Refund",
    EARNING: "Earning",
    WITHDRAWAL: "Withdraw",
    ADJUSTMENT: "Adjustment",
  };
  return map[type];
}

const FILTER_TABS: { value: WalletTxType | null; label: string }[] = [
  { value: null, label: "Semua" },
  { value: "TOPUP", label: "Top Up" },
  { value: "PAYMENT", label: "Bayar" },
  { value: "EARNING", label: "Earning" },
  { value: "REFUND", label: "Refund" },
  { value: "WITHDRAWAL", label: "Withdraw" },
];

export function WalletTransactionsList({
  filterType: initialFilter = null,
  compact = false,
  accent = "saffron",
}: WalletTransactionsListProps) {
  const [filter, setFilter] = useState<WalletTxType | null>(initialFilter);
  const [items, setItems] = useState<WalletTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p: number, f: WalletTxType | null, silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (f) params.set("type", f);
      const res = await fetch(`/api/wallet/transactions?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(data.items ?? []);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat transaksi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(1, filter);
  }, [filter, load]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 accent-" + accent)}>
      {/* Filter tabs */}
      {!compact && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value ?? "all"}
              onClick={() => setFilter(tab.value)}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-600 transition-premium",
                filter === tab.value
                  ? "bg-role text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => load(page, filter, true)}
            disabled={refreshing}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-premium hover:bg-muted/70"
            title="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
        </div>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Inbox className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-600 text-foreground">Belum ada transaksi</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Riwayat transaksi dompet akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((tx, idx) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.02 }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition-premium hover:shadow-card"
            >
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                txBg(tx.type),
              )}>
                {tx.status === "PENDING" ? <Clock className="h-4 w-4" /> : txIcon(tx.type)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-700 text-foreground">
                    {tx.description}
                  </p>
                  {tx.status === "PENDING" && (
                    <Badge variant="outline" className="shrink-0 border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      <Clock className="mr-1 h-2.5 w-2.5" /> Pending
                    </Badge>
                  )}
                  {tx.status === "FAILED" && (
                    <Badge variant="outline" className="shrink-0 border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                      Gagal
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{txTypeLabel(tx.type)}</span>
                  <span>•</span>
                  <span>{formatDate(tx.createdAt)}</span>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className={cn("text-sm font-700 tabular-nums", txColor(tx.type))}>
                  {tx.status === "FAILED" ? "—" : formatRupiah(tx.amount)}
                </p>
                {tx.status === "SUCCESS" && (
                  <p className="text-[0.65rem] text-muted-foreground tabular-nums">
                    Saldo: Rp {tx.balanceAfter.toLocaleString("id-ID")}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => load(page - 1, filter)}
          >
            Sebelumnya
          </Button>
          <span className="text-xs text-muted-foreground">
            Hal. {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => load(page + 1, filter)}
          >
            Berikutnya
          </Button>
        </div>
      )}
    </div>
  );
}
