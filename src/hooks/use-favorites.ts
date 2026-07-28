"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";

/**
 * Hook untuk manage favorites state.
 * - Fetch list on mount (customer only)
 * - Toggle favorite via POST /api/favorites
 * - isFavorited(merchantId) helper
 */
export function useFavorites() {
  const user = useAuthStore((s) => s.user);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    if (!user || user.role !== "CUSTOMER") {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/favorites", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.items) {
        setFavoriteIds(new Set(data.items.map((f: { merchant: { id: string } }) => f.merchant.id)));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const toggle = useCallback(async (merchantId: string, restaurantName?: string) => {
    // Optimistic update
    const wasFavorited = favoriteIds.has(merchantId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorited) next.delete(merchantId);
      else next.add(merchantId);
      return next;
    });

    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ merchantId }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Rollback
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorited) next.add(merchantId);
          else next.delete(merchantId);
          return next;
        });
        toast.error(data?.error || "Gagal mengubah favorit.");
        return;
      }
      if (restaurantName) {
        toast.success(
          data.favorited ? `"${restaurantName}" ditambahkan ke favorit.` : `"${restaurantName}" dihapus dari favorit.`,
        );
      }
    } catch {
      // Rollback
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.add(merchantId);
        else next.delete(merchantId);
        return next;
      });
      toast.error("Koneksi bermasalah.");
    }
  }, [favoriteIds]);

  const isFavorited = useCallback((merchantId: string) => favoriteIds.has(merchantId), [favoriteIds]);

  return { favoriteIds, isFavorited, toggle, loading, refetch: fetchFavorites };
}
