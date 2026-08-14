"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "rejofood_recent_searches";
const MAX_HISTORY = 8;

export interface RecentSearch {
  query: string;
  mode: "restaurants" | "menu";
  timestamp: number;
}

/**
 * Hook untuk manage recent search history.
 * Simpan di localStorage, show sebagai suggestions di search bar.
 */
export function useRecentSearches() {
  const [searches, setSearches] = useState<RecentSearch[]>([]);

  // Load dari localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentSearch[];
        if (Array.isArray(parsed)) {
          setSearches(parsed.slice(0, MAX_HISTORY));
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const addSearch = useCallback((query: string, mode: "restaurants" | "menu") => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    setSearches((prev) => {
      // Remove duplikat (same query + mode)
      const filtered = prev.filter(
        (s) => !(s.query.toLowerCase() === trimmed.toLowerCase() && s.mode === mode),
      );
      // Add di awal
      const next = [{ query: trimmed, mode, timestamp: Date.now() }, ...filtered].slice(0, MAX_HISTORY);
      // Persist ke localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }, []);

  const clearSearches = useCallback(() => {
    setSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const removeSearch = useCallback((query: string, mode: "restaurants" | "menu") => {
    setSearches((prev) => {
      const next = prev.filter(
        (s) => !(s.query.toLowerCase() === query.toLowerCase() && s.mode === mode),
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { searches, addSearch, clearSearches, removeSearch };
}
