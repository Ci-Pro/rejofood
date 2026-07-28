"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, MapPin, UtensilsCrossed, Plus, Soup, ShoppingBag, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  category: string;
}

interface RestaurantDetail {
  id: string;
  restaurantName: string;
  description: string | null;
  logoUrl: string | null;
  address: string | null;
  cuisine: string | null;
  rating: number;
  isOpen: boolean;
  menuItems: MenuItem[];
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

function initialColor(name: string): string {
  const colors = [
    "bg-saffron text-saffron-foreground",
    "bg-lavender text-lavender-foreground",
    "bg-mint text-mint-foreground",
    "bg-rose text-rose-foreground",
    "bg-primary text-primary-foreground",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

export function RestaurantDetailDialog({
  restaurantId,
  onClose,
}: {
  restaurantId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cart conflict state
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);

  useEffect(() => {
    if (!restaurantId) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/restaurants/${restaurantId}`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json?.error || "Gagal memuat detail.");
          return;
        }
        setData(json.merchant);
      } catch {
        if (!cancelled) setError("Koneksi bermasalah.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [restaurantId]);

  // Group menu by category
  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, MenuItem[]>();
    for (const item of data.menuItems) {
      const cat = item.category || "Lainnya";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return Array.from(map.entries());
  }, [data]);

  function handleAddToCart(item: MenuItem) {
    if (!data) return;
    const result = useCartStore.getState().addItem({
      menuItemId: item.id,
      merchantId: data.id,
      restaurantName: data.restaurantName,
      name: item.name,
      price: item.price,
      category: item.category,
    });
    if (result.conflict) {
      // Beda merchant — tampilkan dialog konfirmasi clear cart
      setPendingItem(item);
      setConflictOpen(true);
      return;
    }
    toast.success(`"${item.name}" ditambahkan ke keranjang.`);
  }

  function confirmForceAdd() {
    if (!pendingItem || !data) return;
    useCartStore.getState().forceAddItem({
      menuItemId: pendingItem.id,
      merchantId: data.id,
      restaurantName: data.restaurantName,
      name: pendingItem.name,
      price: pendingItem.price,
      category: pendingItem.category,
    });
    toast.success(`Keranjang diganti dengan "${pendingItem.name}".`);
    setPendingItem(null);
    setConflictOpen(false);
  }

  return (
    <AnimatePresence>
      {restaurantId && (
        <>
          {/* Backdrop */}
          <motion.button
            type="button"
            aria-label="Tutup detail"
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Drawer from right */}
          <motion.div
            className="accent-saffron fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-background shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            {/* Header */}
            <div className="relative shrink-0 overflow-hidden border-b border-border/60 bg-primary">
              <div
                className="pointer-events-none absolute inset-0 opacity-95"
                style={{
                  background:
                    "radial-gradient(120% 80% at 100% 0%, oklch(0.38 0.10 296) 0%, oklch(0.26 0.10 296) 55%, oklch(0.20 0.06 296) 100%)",
                }}
                aria-hidden
              />
              <div className="relative z-10 flex items-start gap-3 p-5 text-primary-foreground">
                <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-display text-2xl font-700", initialColor(data?.restaurantName ?? "R"))}>
                  {data?.restaurantName?.charAt(0).toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl font-700 leading-tight">
                      {data?.restaurantName ?? (loading ? "Memuat…" : "—")}
                    </h2>
                    {data && (
                      data.isOpen ? (
                        <Badge variant="outline" className="border-mint/40 bg-mint/15 px-1.5 text-[0.6rem] font-700 text-mint">
                          BUKA
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-white/20 bg-white/10 px-1.5 text-[0.6rem] font-700 text-primary-foreground/80">
                          TUTUP
                        </Badge>
                      )
                    )}
                  </div>
                  {data?.cuisine && (
                    <p className="mt-0.5 text-[0.7rem] uppercase tracking-wider text-primary-foreground/60">
                      {data.cuisine}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-primary-foreground/80">
                    {data && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-saffron text-saffron" />
                        <span className="font-700">{data.rating.toFixed(1)}</span>
                      </span>
                    )}
                    {data?.address && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{data.address}</span>
                      </span>
                    )}
                    {data && (
                      <span className="flex items-center gap-1">
                        <UtensilsCrossed className="h-3 w-3" />
                        {data.menuItems.length} menu
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup"
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-primary-foreground hover:bg-white/20"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {data?.description && (
                <p className="relative z-10 -mb-1 px-5 pb-4 text-xs leading-relaxed text-primary-foreground/70">
                  {data.description}
                </p>
              )}
            </div>

            {/* Body: menu list */}
            <div className="flex-1 overflow-y-auto scroll-slim p-4">
              {loading && (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-muted/50" />
                  ))}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {!loading && !error && grouped.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Soup className="mx-auto h-8 w-8" />
                  <p className="mt-2 font-600">Belum ada menu tersedia</p>
                  <p className="mt-1 text-xs">Restoran ini belum menambahkan menu.</p>
                </div>
              )}

              {!loading && !error && grouped.map(([category, items]) => (
                <div key={category} className="mb-5">
                  <div className="accent-saffron mb-2 flex items-center gap-2">
                    <h3 className="font-display text-sm font-700 uppercase tracking-wide text-role">{category}</h3>
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[0.65rem] text-muted-foreground">{items.length} item</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-saffron/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-700 text-foreground">{item.name}</p>
                          {item.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                          )}
                          <p className="mt-1.5 font-display text-sm font-700 text-saffron">
                            {formatRupiah(item.price)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleAddToCart(item)}
                          disabled={!data?.isOpen}
                          className="accent-saffron h-8 shrink-0 bg-role-soft px-2.5 text-role hover:bg-role hover:text-role-fg disabled:opacity-40"
                          aria-label={`Tambah ${item.name} ke keranjang`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Tambah
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer placeholder — cart & checkout akan datang di phase 2 */}
            {data && data.isOpen && (
              <div className="shrink-0 border-t border-border bg-card/80 p-3 backdrop-blur-sm">
                <div className="accent-saffron flex items-center justify-between rounded-xl border border-role/30 bg-role-soft/40 px-3 py-2 text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Keranjang Anda
                  </span>
                  <span className="font-600 text-role">Lihat di pojok kanan bawah</span>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* Conflict dialog: beda merchant */}
      <Dialog open={conflictOpen} onOpenChange={(o) => !o && setConflictOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-saffron" />
              Ganti restoran?
            </DialogTitle>
            <DialogDescription>
              Keranjang Anda sudah berisi item dari restoran lain. Tambahkan item ini akan
              mengosongkan keranjang sebelumnya.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConflictOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={confirmForceAdd}
              className="accent-saffron bg-role text-role-fg hover:opacity-90"
            >
              Ganti keranjang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AnimatePresence>
  );
}
