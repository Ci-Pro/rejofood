"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCircle2, X, Clock, ChefHat, Bike, Home, CreditCard, Package } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  type: string;
}

const NOTIF_KEY = "rejofood-notifications";

export function NotificationBell() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load from localStorage
  useEffect(() => {
    if (!user) return;
    try {
      const stored = localStorage.getItem(`${NOTIF_KEY}-${user.id}`);
      if (stored) setNotifications(JSON.parse(stored));
    } catch { /* silent */ }
  }, [user]);

  // Save to localStorage
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`${NOTIF_KEY}-${user.id}`, JSON.stringify(notifications));
  }, [notifications, user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function clearAll() {
    setNotifications([]);
  }

  function addNotification(notif: Omit<Notification, "id" | "timestamp" | "read">) {
    setNotifications((prev) => [
      { ...notif, id: Date.now().toString(), timestamp: new Date().toISOString(), read: false },
      ...prev,
    ].slice(0, 20)); // keep last 20
  }

  // Listen for order socket events → add notification
  useEffect(() => {
    if (!user) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        addNotification({
          title: detail.title || "Notifikasi",
          body: detail.body || "",
          type: detail.type || "order",
        });
      }
    };
    window.addEventListener("rejofood:notification", handler);

    // Also listen for order:status events from useOrderSocket
    const statusHandler = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (!data?.code || !data?.to) return;

      const statusMessages: Record<string, { title: string; body: string }> = {
        ACCEPTED: { title: "Pesanan diterima!", body: `Order ${data.code} sedang diproses` },
        PREPARING: { title: "Mulai dimasak", body: `Order ${data.code} sedang disiapkan` },
        READY: { title: "Pesanan siap!", body: `Order ${data.code} menunggu driver` },
        PICKED_UP: { title: "Driver dalam perjalanan", body: `Order ${data.code} sedang diantar` },
        DELIVERED: { title: "Pesanan tiba!", body: `Order ${data.code} telah sampai` },
        CANCELLED: { title: "Pesanan dibatalkan", body: `Order ${data.code} dibatalkan` },
        PAID: { title: "Pembayaran berhasil", body: `Order ${data.code} sudah dibayar` },
      };

      const msg = statusMessages[data.to];
      if (msg) {
        addNotification({
          title: msg.title,
          body: msg.body,
          type: "order_status",
        });
      }
    };
    window.addEventListener("rejofood:order-status", statusHandler);

    return () => {
      window.removeEventListener("rejofood:notification", handler);
      window.removeEventListener("rejofood:order-status", statusHandler);
    };
  }, [user]);

  if (!user) return null;

  function formatTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "baru saja";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}j`;
    return `${Math.floor(hours / 24)}h`;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="press-feedback relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-card transition-premium hover:border-role/30"
        aria-label="Notifikasi"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose px-1 text-[0.55rem] font-700 text-rose-foreground shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="Tutup notifikasi"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-border bg-popover shadow-premium-lg"
            >
              <div className="flex items-center justify-between border-b border-border p-3">
                <p className="text-sm font-700 text-foreground">Notifikasi</p>
                <div className="flex gap-1">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-[0.65rem] font-600 text-saffron hover:underline"
                    >
                      Tandai dibaca
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-[0.65rem] font-600 text-muted-foreground hover:text-destructive"
                    >
                      Hapus semua
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto scroll-slim">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell className="mx-auto h-6 w-6 text-muted-foreground/40" />
                    <p className="mt-2 text-xs text-muted-foreground">Belum ada notifikasi</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const icon = n.type === "order_status" && n.title.includes("diterima") ? CheckCircle2
                      : n.title.includes("dimasak") ? ChefHat
                      : n.title.includes("siap") ? Package
                      : n.title.includes("dalam perjalanan") ? Bike
                      : n.title.includes("tiba") ? Home
                      : n.title.includes("Pembayaran") ? CreditCard
                      : n.title.includes("dibatalkan") ? X
                      : Bell;
                    const Icon = icon;
                    return (
                    <div
                      key={n.id}
                      className={cn(
                        "border-b border-border/60 p-3 transition-colors",
                        !n.read && "bg-primary/5",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                          n.read ? "bg-muted" : "bg-primary/15",
                        )}>
                          <Icon className={cn("h-3 w-3", n.read ? "text-muted-foreground" : "text-primary")} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-700 text-foreground">{n.title}</p>
                          <p className="text-[0.7rem] text-muted-foreground">{n.body}</p>
                          <p className="mt-0.5 flex items-center gap-0.5 text-[0.6rem] text-muted-foreground/60">
                            <Clock className="h-2 w-2" /> {formatTime(n.timestamp)}
                          </p>
                        </div>
                        {!n.read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
