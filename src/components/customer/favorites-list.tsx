"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Star, MapPin, UtensilsCrossed, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RestaurantDetailDialog } from "./restaurant-detail-dialog";
import { cn } from "@/lib/utils";

interface FavoriteItem {
  id: string;
  merchant: {
    id: string;
    restaurantName: string;
    description: string | null;
    logoUrl: string | null;
    address: string | null;
    cuisine: string | null;
    rating: number;
    isOpen: boolean;
    menuCount: number;
  };
  favoritedAt: string;
}

function cuisineColor(cuisine: string | null): string {
  if (!cuisine) return "bg-muted text-muted-foreground";
  const map: Record<string, string> = {
    Indonesia: "bg-saffron/15 text-saffron",
    Padang: "bg-rose/15 text-rose",
    Chinese: "bg-lavender/15 text-lavender",
    Cafe: "bg-mint/15 text-mint",
    Vegan: "bg-mint/20 text-mint",
  };
  return map[cuisine] ?? "bg-muted text-muted-foreground";
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function FavoritesList() {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/favorites", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal memuat favorit.");
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setError("Koneksi bermasalah.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  return (
    <>
      <section className="mb-4 flex items-center justify-between">
        <div className="accent-saffron flex items-center gap-2">
          <Heart className="h-4 w-4 fill-role text-role" />
          <h2 className="font-display text-lg font-700 text-foreground">Restoran favorit</h2>
        </div>
        <Button variant="outline" size="sm" onClick={fetchFavorites} disabled={loading} className="h-8">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </section>

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col rounded-2xl border border-border bg-card p-4">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-muted" />
              <div className="mt-3 h-3.5 w-2/3 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-2.5 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary">
            <Heart className="h-9 w-9 text-muted-foreground" />
          </div>
          <p className="mt-4 font-display text-lg font-700 text-foreground">Belum ada favorit</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Tap ikon hati di restoran untuk menyimpan favoritmu di sini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {items.map((f, idx) => {
              const r = f.merchant;
              return (
                <motion.button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.2) }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  className="accent-saffron group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-premium transition-premium hover:border-role/40"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-xl font-700", initialColor(r.restaurantName))}>
                      {r.restaurantName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-display text-base font-700 text-foreground">{r.restaurantName}</h3>
                        <Heart className="h-3.5 w-3.5 shrink-0 fill-role text-role" />
                      </div>
                      {r.cuisine && (
                        <Badge variant="outline" className={cn("mt-1 h-5 border-transparent px-1.5 text-[0.6rem] font-700", cuisineColor(r.cuisine))}>
                          {r.cuisine}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {r.description && (
                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{r.description}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-3 text-[0.7rem] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-saffron text-saffron" />
                      <span className="font-700 text-foreground">{r.rating.toFixed(1)}</span>
                    </span>
                    {r.address && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{r.address.split(",")[0]}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <UtensilsCrossed className="h-3 w-3" />
                      {r.menuCount} menu
                    </span>
                  </div>

                  <p className="mt-2 text-[0.6rem] text-muted-foreground/60">
                    Disimpan {formatTime(f.favoritedAt)}
                  </p>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <RestaurantDetailDialog
        restaurantId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
