"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Tag, Plus, Trash2, Loader2, RefreshCw, Power, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Promo {
  id: string;
  code: string;
  description: string;
  type: "PERCENTAGE" | "FLAT";
  value: number;
  minOrder: number;
  maxDiscount: number;
  quota: number;
  usedCount: number;
  isActive: boolean;
  endsAt: string;
  merchant: { id: string; restaurantName: string } | null;
  createdAt: string;
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function isExpired(endsAt: string): boolean {
  return new Date(endsAt) < new Date();
}

export function PromoManagement() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/admin/promos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPromos(data.items ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat promo");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(promo: Promo) {
    try {
      const res = await fetch(`/api/admin/promos/${promo.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !promo.isActive }),
      });
      if (!res.ok) throw new Error("Gagal update");
      toast.success(`Promo ${promo.code} ${!promo.isActive ? "diaktifkan" : "dinonaktifkan"}`);
      load(true);
    } catch {
      toast.error("Gagal mengubah status promo");
    }
  }

  async function deletePromo(promo: Promo) {
    if (!confirm(`Hapus promo ${promo.code}? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      const res = await fetch(`/api/admin/promos/${promo.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal hapus");
      toast.success(`Promo ${promo.code} dihapus`);
      load(true);
    } catch {
      toast.error("Gagal menghapus promo");
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-700">Manajemen Promo</h2>
          <p className="text-xs text-muted-foreground">{promos.length} promo terdaftar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4" /> Buat Promo
          </Button>
        </div>
      </div>

      {promos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary">
            <Tag className="h-9 w-9 text-muted-foreground" />
          </div>
          <p className="mt-4 font-display text-lg font-700">Belum ada promo</p>
          <p className="mt-1 text-sm text-muted-foreground">Buat promo pertama untuk menarik customer.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {promos.map((promo, idx) => {
            const expired = isExpired(promo.endsAt);
            const quotaUsed = promo.quota > 0 ? `${promo.usedCount}/${promo.quota}` : `${promo.usedCount}`;
            return (
              <motion.div
                key={promo.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                className={cn(
                  "rounded-2xl border bg-card p-4 transition-premium",
                  !promo.isActive || expired ? "border-border opacity-60" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm font-700 text-foreground">{promo.code}</code>
                      {promo.isActive && !expired ? (
                        <Badge variant="outline" className="border-mint/40 bg-mint/10 text-mint">Aktif</Badge>
                      ) : expired ? (
                        <Badge variant="outline" className="border-rose/40 bg-rose/10 text-rose">Expired</Badge>
                      ) : (
                        <Badge variant="outline" className="border-border text-muted-foreground">Nonaktif</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{promo.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-700 text-foreground">
                        {promo.type === "PERCENTAGE" ? `${promo.value}%` : formatRupiah(promo.value)}
                      </span>
                      {promo.minOrder > 0 && <span>Min: {formatRupiah(promo.minOrder)}</span>}
                      {promo.maxDiscount > 0 && <span>Maks: {formatRupiah(promo.maxDiscount)}</span>}
                      <span>Pakai: {quotaUsed}</span>
                      <span>Berakhir: {formatDate(promo.endsAt)}</span>
                      {promo.merchant && <span className="text-primary">Khusus: {promo.merchant.restaurantName}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => toggleActive(promo)}
                      disabled={expired}
                      className="h-8 px-2"
                    >
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => deletePromo(promo)}
                      className="h-8 px-2 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <CreatePromoDialog open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={() => load(true)} />
    </div>
  );
}

function CreatePromoDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    code: "", description: "", type: "PERCENTAGE", value: 10,
    minOrder: 0, maxDiscount: 0, quota: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (form.code.trim().length < 3) { toast.error("Code minimal 3 karakter"); return; }
    if (!form.description.trim()) { toast.error("Deskripsi wajib diisi"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/promos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Promo ${form.code.toUpperCase()} dibuat!`);
      setForm({ code: "", description: "", type: "PERCENTAGE", value: 10, minOrder: 0, maxDiscount: 0, quota: 0 });
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat promo");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tag className="h-5 w-5 text-primary" /> Buat Promo</DialogTitle>
          <DialogDescription>Buat kode promo untuk customer</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-600 uppercase tracking-wide text-muted-foreground">Kode Promo</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="HEMAT20" className="font-mono uppercase" maxLength={20} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-600 uppercase tracking-wide text-muted-foreground">Deskripsi</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Diskon 20% untuk pesanan" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-600 uppercase tracking-wide text-muted-foreground">Tipe</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Persentase (%)</SelectItem>
                  <SelectItem value="FLAT">Rupiah (Rp)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-600 uppercase tracking-wide text-muted-foreground">Nilai</Label>
              <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-600 uppercase tracking-wide text-muted-foreground">Min Order</Label>
              <Input type="number" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-600 uppercase tracking-wide text-muted-foreground">Maks Diskon</Label>
              <Input type="number" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-600 uppercase tracking-wide text-muted-foreground">Kuota</Label>
              <Input type="number" value={form.quota} onChange={(e) => setForm({ ...form, quota: Number(e.target.value) })} placeholder="0 = unlimited" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Batal</Button>
          <Button onClick={submit} disabled={submitting} className="bg-primary text-primary-foreground">
            {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Buat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
