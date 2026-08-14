"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UtensilsCrossed, Plus, RefreshCw, Pencil, Trash2, Eye, EyeOff,
  AlertCircle, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MerchantInfo } from "./menu-manager-bridge";
import { ImageUploader } from "@/components/shared/image-uploader";

export type { MerchantInfo };

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  category: string;
  isAvailable: boolean;
  createdAt: string;
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

interface EditForm {
  name: string;
  description: string;
  price: string;
  category: string;
  isAvailable: boolean;
  imageUrl: string | null;
}

const EMPTY_FORM: EditForm = {
  name: "",
  description: "",
  price: "",
  category: "Makanan",
  isAvailable: true,
  imageUrl: null,
};

export function MenuManager({ onInfoLoaded }: { onInfoLoaded?: (info: MerchantInfo) => void }) {
  const [info, setInfo] = useState<MerchantInfo | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit/Create dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/merchant/menu", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal memuat menu.");
        return;
      }
      setInfo(data.merchant);
      setItems(data.items ?? []);
      onInfoLoaded?.(data.merchant);
    } catch {
      setError("Koneksi bermasalah.");
    } finally {
      setLoading(false);
    }
  }, [onInfoLoaded]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setEditOpen(true);
  }

  function openEdit(item: MenuItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      category: item.category,
      isAvailable: item.isAvailable,
      imageUrl: item.imageUrl,
    });
    setEditOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const price = Math.floor(Number(form.price));

    if (name.length < 2) {
      toast.error("Nama menu minimal 2 karakter.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Harga tidak valid.");
      return;
    }
    if (price > 10_000_000) {
      toast.error("Harga maksimum Rp 10.000.000.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name,
        description: form.description.trim() || null,
        price,
        category: form.category.trim() || "Lainnya",
        isAvailable: form.isAvailable,
        imageUrl: form.imageUrl,
      };
      const url = editingId
        ? `/api/merchant/menu/${editingId}`
        : "/api/merchant/menu";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Gagal menyimpan menu.");
        return;
      }
      toast.success(editingId ? "Menu diperbarui." : "Menu baru ditambahkan.");
      setEditOpen(false);
      await fetchMenu();
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(item: MenuItem) {
    // Optimistic update
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i));
    try {
      const res = await fetch(`/api/merchant/menu/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      if (!res.ok) {
        // Rollback
        setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isAvailable: item.isAvailable } : i));
        toast.error("Gagal mengubah status.");
        return;
      }
      toast.success(`${item.name} ${item.isAvailable ? "disembunyikan" : "ditampilkan"}.`);
    } catch {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isAvailable: item.isAvailable } : i));
      toast.error("Koneksi bermasalah.");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/merchant/menu/${deleteId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Gagal menghapus menu.");
        return;
      }
      toast.success(`"${deleteName}" dihapus permanen.`);
      setDeleteId(null);
      await fetchMenu();
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setDeleting(false);
    }
  }

  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category || "Lainnya";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="accent-lavender flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-role text-role-fg">
            <UtensilsCrossed className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
          <div>
            <h3 className="font-display text-lg font-700 text-foreground">Kelola Menu</h3>
            <p className="text-xs text-muted-foreground">
              {info?.restaurantName ?? "—"} · {items.length} item
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchMenu} disabled={loading} className="h-8">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={openCreate} className="accent-lavender h-8 bg-role text-role-fg hover:opacity-90">
            <Plus className="h-3.5 w-3.5" />
            Tambah
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-muted/50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <UtensilsCrossed className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-600 text-foreground">Belum ada menu</p>
          <p className="mt-1 text-xs text-muted-foreground">Klik "Tambah" untuk menambah menu pertama.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, catItems]) => (
            <div key={category}>
              <div className="accent-lavender mb-2 flex items-center gap-2">
                <h4 className="text-xs font-700 uppercase tracking-wide text-role">{category}</h4>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[0.65rem] text-muted-foreground">{catItems.length} item</span>
              </div>
              <div className="space-y-1.5">
                {catItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    className={cn(
                      "flex flex-wrap items-center gap-2 rounded-xl border bg-background/60 p-2.5 transition-colors sm:gap-3 sm:p-2.5",
                      item.isAvailable ? "border-border" : "border-border/50 opacity-60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-700 text-foreground">{item.name}</p>
                        {!item.isAvailable && (
                          <Badge variant="outline" className="h-4 border-border px-1 text-[0.55rem] font-700 text-muted-foreground">
                            TERSEMBUNYI
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                    <p className="shrink-0 font-display text-sm font-700 text-lavender">
                      {formatRupiah(item.price)}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAvailability(item)}
                        className="h-8 w-8 p-0"
                        title={item.isAvailable ? "Sembunyikan dari pelanggan" : "Tampilkan ke pelanggan"}
                      >
                        {item.isAvailable ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(item)}
                        className="h-8 w-8 p-0"
                        title="Edit menu"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => { setDeleteId(item.id); setDeleteName(item.name); }}
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                        title="Hapus permanen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit menu" : "Tambah menu baru"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 py-2">
            {/* Image upload */}
            <ImageUploader
              value={form.imageUrl}
              onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
              folder="menu"
              shape="square"
              size={88}
              label="Foto menu"
            />

            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                Nama menu
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nasi Goreng Spesial"
                required
                autoFocus
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                Deskripsi <span className="text-muted-foreground/60">(opsional)</span>
              </Label>
              <Textarea
                id="desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Nasi goreng dengan ayam, telur, dan kerupuk."
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="price" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                  Harga (Rp)
                </Label>
                <Input
                  id="price"
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="25000"
                  required
                  min={0}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                  Kategori
                </Label>
                <Input
                  id="cat"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Makanan"
                  className="h-10"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-background/60 p-2.5">
              <input
                type="checkbox"
                checked={form.isAvailable}
                onChange={(e) => setForm((f) => ({ ...f, isAvailable: e.target.checked }))}
                className="h-4 w-4 accent-lavender"
              />
              <div className="flex-1">
                <p className="text-sm font-600 text-foreground">Tersedia untuk dipesan</p>
                <p className="text-xs text-muted-foreground">Nascent: pelanggan bisa lihat & pesan.</p>
              </div>
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                Batal
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="accent-lavender bg-role text-role-fg hover:opacity-90"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan…</>
                ) : editingId ? (
                  "Simpan perubahan"
                ) : (
                  <><Plus className="h-4 w-4" /> Tambah menu</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus menu "{deleteName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini permanen. Item akan dihapus dari database.
              Untuk menyembunyikan sementara, gunakan tombol mata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Hapus permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
