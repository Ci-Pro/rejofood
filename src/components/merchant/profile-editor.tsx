"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Store, Pencil, Loader2, Check, X, Star, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ImageUploader } from "@/components/shared/image-uploader";

interface MerchantInfo {
  id: string;
  restaurantName: string;
  description: string | null;
  address: string | null;
  cuisine: string | null;
  logoUrl: string | null;
  promoTag: string | null;
  prepTime: number;
  openHours: string | null;
  closeHours: string | null;
  rating: number;
  isOpen: boolean;
}

interface ProfileEditorProps {
  /** Initial info dari MenuManager fetch. Optional — kalau null, fetch sendiri. */
  info: MerchantInfo | null;
  onUpdated?: (info: MerchantInfo) => void;
}

export function ProfileEditor({ info, onUpdated }: ProfileEditorProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    restaurantName: "",
    description: "",
    address: "",
    cuisine: "",
    promoTag: "",
    prepTime: 15,
    openHours: "",
    closeHours: "",
  });

  useEffect(() => {
    if (info) {
      setForm({
        restaurantName: info.restaurantName,
        description: info.description ?? "",
        address: info.address ?? "",
        cuisine: info.cuisine ?? "",
        promoTag: info.promoTag ?? "",
        prepTime: info.prepTime ?? 15,
        openHours: info.openHours ?? "",
        closeHours: info.closeHours ?? "",
      });
    }
  }, [info]);

  async function toggleOpen() {
    if (!info) return;
    const newValue = !info.isOpen;
    // Optimistic
    onUpdated?.({ ...info, isOpen: newValue });
    try {
      const res = await fetch("/api/merchant/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isOpen: newValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Rollback
        onUpdated?.({ ...info, isOpen: info.isOpen });
        toast.error(data?.error || "Gagal mengubah status.");
        return;
      }
      onUpdated?.(data.merchant);
      toast.success(newValue ? "Restoran dibuka. Siap menerima pesanan." : "Restoran ditutup sementara.");
    } catch {
      onUpdated?.({ ...info, isOpen: info.isOpen });
      toast.error("Koneksi bermasalah.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        restaurantName: form.restaurantName.trim(),
        description: form.description.trim() || null,
        address: form.address.trim() || null,
        cuisine: form.cuisine.trim() || null,
        logoUrl: info?.logoUrl ?? null,
        promoTag: form.promoTag.trim() || null,
        prepTime: Number(form.prepTime) || 15,
        openHours: form.openHours.trim() || null,
        closeHours: form.closeHours.trim() || null,
      };
      const res = await fetch("/api/merchant/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Gagal menyimpan profil.");
        return;
      }
      onUpdated?.(data.merchant);
      toast.success("Profil restoran diperbarui.");
      setEditing(false);
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setSaving(false);
    }
  }

  if (!info) return null;

  return (
    <section className="accent-lavender rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {info.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={info.logoUrl}
              alt={info.restaurantName}
              loading="lazy"
              decoding="async"
              className="h-12 w-12 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-role text-role-fg">
              <Store className="h-4.5 w-4.5" strokeWidth={2.2} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-700 text-foreground">{info.restaurantName}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-saffron text-saffron" />
                <span className="font-700 text-foreground">{info.rating.toFixed(1)}</span>
              </span>
              {info.cuisine && <span>· {info.cuisine}</span>}
              {info.address && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{info.address}</span>
                </span>
              )}
            </div>
            {info.description && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{info.description}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Open/Closed toggle */}
          <div className="flex items-center gap-2 rounded-full border border-border bg-background/60 px-2.5 py-1.5">
            <Switch
              checked={info.isOpen}
              onCheckedChange={toggleOpen}
              className="accent-lavender data-[state=checked]:bg-role"
              aria-label="Toggle restoran buka/tutup"
            />
            <span className={cn(
              "text-xs font-700",
              info.isOpen ? "text-mint" : "text-muted-foreground",
            )}>
              {info.isOpen ? "BUKA" : "TUTUP"}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing((s) => !s)}
            className="h-8"
          >
            {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editing ? "Batal" : "Edit"}
          </Button>
        </div>
      </div>

      {/* Inline edit form */}
      {editing && (
        <motion.form
          onSubmit={onSubmit}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 space-y-3 border-t border-border pt-4"
        >
          {/* Logo upload */}
          <ImageUploader
            value={info.logoUrl}
            onChange={(url) => {
              onUpdated?.({ ...info, logoUrl: url });
            }}
            folder="logo"
            shape="rounded"
            size={72}
            label="Logo restoran"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="restaurantName" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                Nama restoran
              </Label>
              <Input
                id="restaurantName"
                value={form.restaurantName}
                onChange={(e) => setForm((f) => ({ ...f, restaurantName: e.target.value }))}
                required
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cuisine" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                Jenis masakan
              </Label>
              <Input
                id="cuisine"
                value={form.cuisine}
                onChange={(e) => setForm((f) => ({ ...f, cuisine: e.target.value }))}
                placeholder="Indonesia / Padang / Chinese / Cafe / Vegan"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                Alamat
              </Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Jl. Contoh No. 1, Jakarta"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promoTag" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                Tag Promo <span className="text-muted-foreground/60">(opsional)</span>
              </Label>
              <Input
                id="promoTag"
                value={form.promoTag}
                onChange={(e) => setForm((f) => ({ ...f, promoTag: e.target.value }))}
                placeholder="Diskon 20%, Beli 1 Gratis 1, dll."
                maxLength={50}
                className="h-10"
              />
              <p className="text-[0.65rem] text-muted-foreground">Tampil di card restoran customer.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prepTime" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                Estimasi Masak (menit)
              </Label>
              <Input
                id="prepTime"
                type="number"
                min={1}
                max={120}
                value={form.prepTime}
                onChange={(e) => setForm((f) => ({ ...f, prepTime: Number(e.target.value) }))}
                className="h-10"
              />
              <p className="text-[0.65rem] text-muted-foreground">Untuk hitung ETA pesanan customer.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="openHours" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                Jam Buka
              </Label>
              <Input
                id="openHours"
                type="time"
                value={form.openHours}
                onChange={(e) => setForm((f) => ({ ...f, openHours: e.target.value }))}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="closeHours" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                Jam Tutup
              </Label>
              <Input
                id="closeHours"
                type="time"
                value={form.closeHours}
                onChange={(e) => setForm((f) => ({ ...f, closeHours: e.target.value }))}
                className="h-10"
              />
              <p className="text-[0.65rem] text-muted-foreground">Kosongkan jika selalu buka 24 jam.</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="description" className="text-xs font-600 uppercase tracking-wide text-muted-foreground">
                Deskripsi
              </Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Masakan rumahan khas Nusantara dengan bahan segar pilihan."
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Batal
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="accent-lavender bg-role text-role-fg hover:opacity-90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Simpan
            </Button>
          </div>
        </motion.form>
      )}
    </section>
  );
}
