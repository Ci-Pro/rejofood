"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Search, Star, MapPin, Clock, UtensilsCrossed, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RestaurantDetailDialog } from "./restaurant-detail-dialog";
import { cn } from "@/lib/utils";

interface RestaurantListItem {
  id: string;
  restaurantName: string;
  description: string | null;
  logoUrl: string | null;
  address: string | null;
  cuisine: string | null;
  rating: number;
  isOpen: boolean;
  menuCount: number;
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

function initial(name: string): string {
  return name.charAt(0).toUpperCase();
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

export function RestaurantGrid() {
  const [items, setItems] = useState<RestaurantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchRestaurants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (openOnly) params.set("openOnly", "true");
      params.set("limit", "50");
      const res = await fetch(`/api/restaurants?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal memuat restoran.");
        return;
      }
      setItems(data.items);
    } catch {
      setError("Koneksi bermasalah.");
    } finally {
      setLoading(false);
    }
  }, [query, openOnly]);

  useEffect(() => {
    const t = setTimeout(fetchRestaurants, 200); // debounce search
    return () => clearTimeout(t);
  }, [fetchRestaurants]);

  return (
    <div>
      {/* Search + filter */}
      <div className="accent-saffron mb-5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari restoran, masakan, atau kata kunci…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 rounded-xl bg-card pl-9"
          />
        </div>
        <Button
          variant={openOnly ? "default" : "outline"}
          onClick={() => setOpenOnly((s) => !s)}
          className={cn(
            "h-10 rounded-xl",
            openOnly && "accent-saffron bg-role text-role-fg hover:opacity-90",
          )}
        >
          <Clock className="h-4 w-4" />
          {openOnly ? "Buka saja" : "Semua"}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-muted/50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <UtensilsCrossed className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-600 text-foreground">Tidak ada restoran ditemukan</p>
          <p className="mt-1 text-xs text-muted-foreground">Coba ubah kata kunci atau filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r, idx) => (
            <motion.button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.04 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-saffron/40"
            >
              {/* Header: avatar + name + open status */}
              <div className="flex items-start gap-3">
                <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-xl font-700", initialColor(r.restaurantName))}>
                  {initial(r.restaurantName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display text-base font-700 text-foreground">{r.restaurantName}</h3>
                    {r.isOpen ? (
                      <Badge variant="outline" className="h-5 shrink-0 border-mint/40 bg-mint/10 px-1.5 text-[0.6rem] font-700 text-mint">
                        BUKA
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-5 shrink-0 border-border bg-muted px-1.5 text-[0.6rem] font-700 text-muted-foreground">
                        TUTUP
                      </Badge>
                    )}
                  </div>
                  {r.cuisine && (
                    <Badge variant="outline" className={cn("mt-1 h-5 border-transparent px-1.5 text-[0.6rem] font-700", cuisineColor(r.cuisine))}>
                      {r.cuisine}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Description */}
              {r.description && (
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {r.description}
                </p>
              )}

              {/* Footer: rating + address + menu count */}
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

              <ChevronRight className="absolute right-3 top-3 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </motion.button>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <RestaurantDetailDialog
        restaurantId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
