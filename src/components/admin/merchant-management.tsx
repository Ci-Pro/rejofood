"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Store, Loader2, RefreshCw, Power, Inbox, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MerchantItem {
  id: string;
  restaurantName: string;
  cuisine: string | null;
  rating: number;
  isOpen: boolean;
  promoTag: string | null;
  prepTime: number;
  address: string | null;
  createdAt: string;
  user: { id: string; email: string; isActive: boolean; isFlagged: boolean };
  menuCount: number;
  orderCount: number;
  reviewCount: number;
}

export function MerchantManagement() {
  const [items, setItems] = useState<MerchantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [openOnly, setOpenOnly] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (openOnly) params.set("openOnly", "true");
      const res = await fetch(`/api/admin/merchants?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(data.items ?? []);
    } catch {
      toast.error("Gagal memuat merchant");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, openOnly]);

  useEffect(() => { load(); }, [load]);

  async function toggleOpen(merchant: MerchantItem) {
    try {
      const res = await fetch(`/api/admin/merchants/${merchant.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isOpen: !merchant.isOpen }),
      });
      if (!res.ok) throw new Error("Gagal");
      toast.success(`${merchant.restaurantName} ${!merchant.isOpen ? "dibuka" : "ditutup"}`);
      setItems(prev => prev.map(m => m.id === merchant.id ? { ...m, isOpen: !m.isOpen } : m));
    } catch {
      toast.error("Gagal mengubah status");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-700">Manajemen Merchant</h2>
          <p className="text-xs text-muted-foreground">{items.length} merchant</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Cari restoran..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 min-w-[8rem] flex-1" onKeyDown={(e) => e.key === "Enter" && load()} />
        <Button variant={openOnly ? "default" : "outline"} size="sm" onClick={() => { setOpenOnly(!openOnly); }}>
          {openOnly ? "Buka saja" : "Semua"}
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary"><Store className="h-9 w-9 text-muted-foreground" /></div>
          <p className="mt-4 font-display text-lg font-700">Belum ada merchant</p>
          <p className="mt-1 text-sm text-muted-foreground">Merchant akan muncul setelah registrasi.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((m, idx) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
              className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display text-sm font-700 text-foreground">{m.restaurantName}</h3>
                    {m.isOpen ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-mint/10 px-2 py-0.5 text-[0.65rem] font-700 text-mint"><span className="h-1.5 w-1.5 rounded-full bg-mint" />Buka</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-700 text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />Tutup</span>
                    )}
                    {m.user.isFlagged && <Badge variant="outline" className="border-rose/40 bg-rose/10 text-rose">Flagged</Badge>}
                    {m.promoTag && <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">{m.promoTag}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{m.cuisine ?? "—"} · {m.user.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-primary text-primary" />{m.rating.toFixed(1)}</span>
                    <span>{m.menuCount} menu</span>
                    <span>{m.orderCount} order</span>
                    <span>{m.reviewCount} review</span>
                    <span>ETA: {m.prepTime}m</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => toggleOpen(m)} className="h-8 px-2 shrink-0">
                  <Power className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
