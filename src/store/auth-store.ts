/**
 * Client-side auth store (Zustand).
 * Mirrors the server session so the SPA shell can switch views without round-trips.
 */
import { create } from "zustand";
import type { SafeUser } from "@/types/auth";

type Role = SafeUser["role"];

interface AuthState {
  user: SafeUser | null;
  isLoading: boolean;
  error: string | null;
  setUser: (u: SafeUser | null) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
  /** Convenience selector */
  isAuthenticated: () => boolean;
  hasRole: (r: Role) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,
  setUser: (u) => set({ user: u, error: null }),
  setLoading: (b) => set({ isLoading: b }),
  setError: (e) => set({ error: e }),
  isAuthenticated: () => !!get().user,
  hasRole: (r) => get().user?.role === r,
}));
