"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { SafeUser } from "@/types/auth";
import { useAuthStore } from "@/store/auth-store";

interface SessionInfo {
  user: SafeUser;
  expiresAt: string;       // ISO
  idleExpiresAt: string | null; // ISO, null untuk non-admin
  absoluteTtlMs: number;
  idleTimeoutMs: number | null;
}

interface SessionState {
  info: SessionInfo | null;
  /** Detik sampai sesi expired (yang paling dekat: absolute atau idle). */
  remainingSeconds: number | null;
  /** True jika < 60 detik lagi. */
  isCritical: boolean;
  /** "idle" jika idle expiry lebih dekat, "absolute" jika TTL absolut lebih dekat, null jika tidak ada. */
  expiringBy: "idle" | "absolute" | null;
  refresh: () => void;
}

const POLL_INTERVAL_MS = 30 * 1000; // 30 detik

function pickEarliest(info: SessionInfo): { at: number; by: "idle" | "absolute" } {
  const abs = new Date(info.expiresAt).getTime();
  const idle = info.idleExpiresAt ? new Date(info.idleExpiresAt).getTime() : Infinity;
  return idle < abs
    ? { at: idle, by: "idle" }
    : { at: abs, by: "absolute" };
}

export function useSessionInfo(): SessionState {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [tick, setTick] = useState(0); // force re-render untuk countdown
  const logoutTriggeredRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session-info", { cache: "no-store" });
      const data = await res.json();
      if (!data?.user) {
        // Session expired server-side → logout client
        if (!logoutTriggeredRef.current) {
          logoutTriggeredRef.current = true;
          setUser(null);
        }
        setInfo(null);
        return;
      }
      setInfo(data as SessionInfo);
    } catch {
      // Network error — keep current state
    }
  }, [setUser]);

  // Poll session info selama user logged in
  useEffect(() => {
    if (!user) return;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, refresh]);

  // Countdown ticker — only setState via setTick (counter), bukan derived values
  useEffect(() => {
    if (!info) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [info]);

  // Compute derived state (no setState in effect)
  void tick; // re-render trigger

  if (!info) {
    return {
      info: null,
      remainingSeconds: null,
      isCritical: false,
      expiringBy: null,
      refresh,
    };
  }

  const { at, by } = pickEarliest(info);
  const remaining = Math.max(0, Math.floor((at - Date.now()) / 1000));

  return {
    info,
    remainingSeconds: remaining,
    isCritical: remaining < 60,
    expiringBy: by,
    refresh,
  };
}
