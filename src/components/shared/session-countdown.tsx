"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, AlertTriangle, LogIn } from "lucide-react";
import { useSessionInfo } from "@/hooks/use-session-info";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

function format(seconds: number): string {
  if (seconds < 60) return `${seconds}d`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}d` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}j ${mm}m`;
}

/**
 * Indikator sesi admin di header.
 *
 * Hanya tampil untuk role ADMIN (karena hanya admin yang punya idle timeout).
 * - Default: clock icon + "Xm" countdown (idle expiry)
 * - < 60 detik: warning merah berdenyut + tombol "Perpanjang" (refresh via fetch)
 *
 * Untuk role lain: tampilkan chip info sesi saja (tanpa countdown) opsional — skip untuk simplicity.
 */
export function SessionCountdown() {
  const session = useSessionInfo();
  const setUser = useAuthStore((s) => s.setUser);
  const notifiedRef = useRef(false);

  // Auto-logout ketika remainingSeconds === 0
  useEffect(() => {
    if (session.remainingSeconds === 0) {
      setUser(null);
      // Force reload to clean state
      window.location.href = "/";
    }
  }, [session.remainingSeconds, setUser]);

  // Toast warning sekali saat masuk critical
  useEffect(() => {
    if (session.isCritical && !notifiedRef.current) {
      notifiedRef.current = true;
    }
    if (!session.isCritical) {
      notifiedRef.current = false;
    }
  }, [session.isCritical]);

  // Hanya tampilkan untuk ADMIN (idle timeout)
  if (session.info?.user.role !== "ADMIN") return null;
  if (session.remainingSeconds === null) return null;

  const isCritical = session.isCritical;
  const isIdle = session.expiringBy === "idle";

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence mode="wait">
        <motion.div
          key={isCritical ? "critical" : "normal"}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-700 tabular-nums",
            isCritical
              ? "border-rose bg-rose/10 text-rose"
              : "border-border bg-card text-muted-foreground",
          )}
          title={isIdle ? "Sesi akan habis jika tidak ada aktivitas" : "Sesi akan habis saat TTL absolut tercapai"}
        >
          {isCritical ? (
            <AlertTriangle className="h-3 w-3 animate-pulse" />
          ) : (
            <Clock className="h-3 w-3" />
          )}
          <span>{format(session.remainingSeconds)}</span>
        </motion.div>
      </AnimatePresence>

      {isCritical && (
        <button
          type="button"
          onClick={session.refresh}
          className="flex items-center gap-1 rounded-full border border-rose/40 bg-rose/10 px-2 py-1 text-[0.65rem] font-700 text-rose hover:bg-rose/20"
          title="Perpanjang sesi (touch aktivitas)"
        >
          <LogIn className="h-3 w-3" />
          Perpanjang
        </button>
      )}
    </div>
  );
}
