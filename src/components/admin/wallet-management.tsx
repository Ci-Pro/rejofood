"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Wallet, Search, Snowflake, Unlock, Loader2, RefreshCw,
  TrendingUp, Users, AlertTriangle, ChevronLeft, ChevronRight,
  Shield, Plus, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WalletItem {
  id: string;
  userId: string;
  balance: number;
  isFrozen: boolean;
  hasPin: boolean;
  createdAt: string;
  updatedAt: string;
  txCount: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    avatarUrl: string | null;
    isActive: boolean;
  };
}

interface Stats {
  totalBalance: number;
  walletCount: number;
  frozenCount: number;
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

const ROLE_COLORS: Record<string, string> = {
  CUSTOMER: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  MERCHANT: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  DRIVER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  ADMIN: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

export function AdminWalletManagement() {
  const [items, setItems] = useState<WalletItem[]>([]);
  const [stats, setStats] = useState<Stats>({ totalBalance: 0, walletCount: 0, frozenCount: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [frozenFilter, setFrozenFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<WalletItem | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const load = useCallback(async (p: number, silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (search) params.set("search", search);
      if (roleFilter !== "ALL") params.set("role", roleFilter);
      if (frozenFilter !== "ALL") params.set("frozen", frozenFilter);
      const res = await fetch(`/api/admin/wallets?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(data.items ?? []);
      setStats(data.stats);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat wallet");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, roleFilter, frozenFilter]);

  useEffect(() => {
    load(1);
  }, [load]);

  async function toggleFreeze(wallet: WalletItem) {
    const action = wallet.isFrozen ? "unfreeze" : "freeze";
    try {
      const res = await fetch(`/api/admin/wallets/${wallet.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(wallet.isFrozen ? "Wallet di-unfreeze" : "Wallet dibekukan");
      load(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal update wallet");
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-4 shadow-card"
        >
          <div className="flex items-center justify-between">
            <span className="text-[0.65rem] font-700 uppercase tracking-wider text-muted-foreground">
              Total Saldo
            </span>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </div>
          <p className="mt-2 font-display text-xl font-700 text-purple-600 dark:text-purple-400">
            {formatRupiah(stats.totalBalance)}
          </p>
          <p className="text-xs text-muted-foreground">Across all wallets</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-card p-4 shadow-card"
        >
          <div className="flex items-center justify-between">
            <span className="text-[0.65rem] font-700 uppercase tracking-wider text-muted-foreground">
              Total Wallet
            </span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 font-display text-xl font-700">{stats.walletCount}</p>
          <p className="text-xs text-muted-foreground">Wallet terdaftar</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-2 rounded-2xl border border-border bg-card p-4 shadow-card sm:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-[0.65rem] font-700 uppercase tracking-wider text-muted-foreground">
              Dibekukan
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 font-display text-xl font-700 text-rose-500">{stats.frozenCount}</p>
          <p className="text-xs text-muted-foreground">Wallet dibekukan</p>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[8rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari email atau nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            onKeyDown={(e) => e.key === "Enter" && load(1)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[7.5rem]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Role</SelectItem>
            <SelectItem value="CUSTOMER">Customer</SelectItem>
            <SelectItem value="MERCHANT">Merchant</SelectItem>
            <SelectItem value="DRIVER">Driver</SelectItem>
          </SelectContent>
        </Select>
        <Select value={frozenFilter} onValueChange={setFrozenFilter}>
          <SelectTrigger className="w-[7.5rem]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua</SelectItem>
            <SelectItem value="false">Aktif</SelectItem>
            <SelectItem value="true">Dibekukan</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => load(page, true)}
          disabled={refreshing}
          title="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Wallet List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Wallet className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-600">Tidak ada wallet</p>
          <p className="mt-1 text-xs text-muted-foreground">Coba ubah filter pencarian</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((w, idx) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className={cn(
                "rounded-2xl border bg-card p-3 shadow-sm transition-premium hover:shadow-card",
                w.isFrozen ? "border-rose-200 dark:border-rose-900/50" : "border-border",
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={w.user.avatarUrl ?? undefined} />
                  <AvatarFallback>{initials(w.user.fullName)}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-700">{w.user.fullName}</p>
                    <Badge
                      variant="outline"
                      className={cn("shrink-0 px-1.5 py-0 text-[0.6rem] font-700 uppercase", ROLE_COLORS[w.user.role])}
                    >
                      {w.user.role}
                    </Badge>
                    {w.isFrozen && (
                      <Badge variant="outline" className="shrink-0 border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                        <Snowflake className="mr-1 h-2.5 w-2.5" /> Frozen
                      </Badge>
                    )}
                    {!w.user.isActive && (
                      <Badge variant="outline" className="shrink-0 border-zinc-300 bg-zinc-100 text-zinc-600 dark:bg-zinc-900/30 dark:text-zinc-400">
                        Banned
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{w.user.email}</p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-display text-sm font-700 tabular-nums">
                    {formatRupiah(w.balance)}
                  </p>
                  <p className="text-[0.65rem] text-muted-foreground">
                    {w.txCount} tx
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setSelected(w); setAdjustOpen(true); }}
                    className="h-8 px-2"
                    title="Adjust saldo"
                  >
                    <Shield className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={w.isFrozen ? "outline" : "destructive"}
                    size="sm"
                    onClick={() => toggleFreeze(w)}
                    className="h-8 px-2"
                    title={w.isFrozen ? "Unfreeze" : "Freeze"}
                  >
                    {w.isFrozen ? <Unlock className="h-3.5 w-3.5" /> : <Snowflake className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Hal. {page} / {totalPages} • {total} wallet
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Adjust dialog */}
      {selected && (
        <AdjustDialog
          open={adjustOpen}
          onClose={() => { setAdjustOpen(false); setSelected(null); }}
          wallet={selected}
          onSuccess={() => load(page)}
        />
      )}
    </div>
  );
}

function AdjustDialog({
  open, onClose, wallet, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  wallet: WalletItem;
  onSuccess: () => void;
}) {
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt <= 0 || amt > 10_000_000) {
      toast.error("Amount harus integer positif, maksimal Rp 10.000.000");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason wajib diisi untuk audit");
      return;
    }

    setSubmitting(true);
    try {
      const signedAmount = direction === "credit" ? amt : -amt;
      const res = await fetch(`/api/admin/wallets/${wallet.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "adjust",
          amount: signedAmount,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Adjustment ${direction === "credit" ? "+" : "-"}${formatRupiah(amt)} berhasil`);
      onSuccess();
      onClose();
      setAmount("");
      setReason("");
      setDirection("credit");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal adjust");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-rose-500" />
            Adjust Saldo Wallet
          </DialogTitle>
          <DialogDescription>
            Manual adjustment untuk wallet {wallet.user.fullName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-muted/50 p-3">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Pemilik</span>
              <span className="font-600">{wallet.user.email}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Saldo Saat Ini</span>
              <span className="font-700">{formatRupiah(wallet.balance)}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Total Tx</span>
              <span className="font-600">{wallet.txCount}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipe Adjustment</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDirection("credit")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-700 transition-premium",
                  direction === "credit"
                    ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "border-border hover:border-green-500/40",
                )}
              >
                <Plus className="h-4 w-4" /> Kredit
              </button>
              <button
                onClick={() => setDirection("debit")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-700 transition-premium",
                  direction === "debit"
                    ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                    : "border-border hover:border-rose-500/40",
                )}
              >
                <Minus className="h-4 w-4" /> Debit
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-amount">Nominal</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
              <Input
                id="adj-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50000"
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">Maksimal Rp 10.000.000 per adjustment</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-reason">Alasan (wajib untuk audit)</Label>
            <Textarea
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Cashback promo agustus, koreksi salah hitung..."
              rows={3}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">{reason.length}/300 karakter</p>
          </div>

          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            ⚠️ Tindakan ini akan dicatat di Audit Log. Pastikan alasan jelas — adjustment tidak bisa di-undo otomatis.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button
            onClick={submit}
            disabled={submitting}
            variant={direction === "credit" ? "default" : "destructive"}
          >
            {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {direction === "credit" ? "Kredit" : "Debit"} Saldo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
