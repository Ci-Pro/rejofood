"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";

/**
 * Hook untuk subscribe ke realtime events.
 *
 * Socket connect via io("/?XTransformPort=3001") — Caddy akan forward ke port 3001.
 * Cookie session otomatis dikirim (same-origin), server-side verify di mini-service.
 *
 * Events yang bisa disubscribe:
 *  - order:created      → order baru masuk (merchant, admin)
 *  - order:status       → status order berubah (all roles)
 *  - order:updated      → generic update
 *
 * @example
 * ```tsx
 * const { isConnected, lastEvent, refetch } = useOrderSocket({
 *   onEvent: (event, data) => {
 *     if (event === "order:status") refetch();
 *   },
 * });
 * ```
 */

export interface RealtimeOrderEvent {
  event: "order:created" | "order:status" | "order:driver_assigned" | "order:updated";
  orderId: string;
  code: string;
  data: Record<string, unknown>;
}

interface UseOrderSocketOptions {
  /** Dipanggil setiap kali event masuk */
  onEvent?: (event: RealtimeOrderEvent["event"], data: RealtimeOrderEvent["data"]) => void;
  /** Auto-show toast untuk event tertentu? Default: true */
  autoToast?: boolean;
}

interface UseOrderSocketResult {
  isConnected: boolean;
  /** Trigger manual refetch (caller provides fetcher) */
  lastEvent: RealtimeOrderEvent | null;
}

let socketInstance: Socket | null = null;
let socketRefCount = 0;
let socketFailed = false;

function getSocket(): Socket | null {
  // Production tanpa realtime service (mis. Vercel tanpa Railway): skip socket
  // NEXT_PUBLIC_REALTIME_URL kosong = disabled, fallback ke polling
  const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL;
  if (!realtimeUrl && typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return null;
  }

  if (socketFailed) return null;

  if (!socketInstance) {
    // Local dev: direct localhost:3001
    // Preview/sandbox: via XTransformPort
    // Production (with NEXT_PUBLIC_REALTIME_URL set): pakai URL tsb
    const isLocalDev = typeof window !== "undefined" && window.location.hostname === "localhost";
    const url = realtimeUrl
      ? realtimeUrl
      : isLocalDev
        ? "http://localhost:3001"
        : "/?XTransformPort=3001";

    try {
      socketInstance = io(url, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5, // fewer retries di production
        reconnectionDelay: 2000,
        timeout: 10000,
        withCredentials: true,
        autoConnect: false,
      });

      // Connect async — jika fail, mark sebagai failed supaya tidak retry forever
      socketInstance.on("connect_error", () => {
        if (socketInstance) {
          socketInstance.disconnect();
          socketInstance = null;
          socketFailed = true;
        }
      });

      socketInstance.connect();
    } catch {
      socketFailed = true;
      return null;
    }
  }
  return socketInstance;
}

export function useOrderSocket(options: UseOrderSocketOptions = {}): UseOrderSocketResult {
  const { onEvent, autoToast = true } = options;
  const user = useAuthStore((s) => s.user);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeOrderEvent | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    // Jika socket null (production tanpa realtime service), skip — fallback ke polling
    if (!socket) {
      setIsConnected(false);
      return;
    }
    socketRefCount++;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onConnected = (data: { user: { id: string; role: string } }) => {
      setIsConnected(true);
    };

    const handleEvent = (event: RealtimeOrderEvent["event"], data: RealtimeOrderEvent["data"]) => {
      setLastEvent({
        event,
        orderId: (data?.orderId as string) ?? "",
        code: (data?.code as string) ?? "",
        data,
      });
      onEventRef.current?.(event, data);

      // Auto-toast untuk user feedback
      if (autoToast && data?.code) {
        const code = data.code as string;
        if (event === "order:created") {
          toast.info(`Pesanan baru: ${code}`, {
            description: `${data.customerName ?? "Customer"} · Rp ${(data.total as number ?? 0).toLocaleString("id-ID")}`,
          });
        } else if (event === "order:status") {
          const from = data.from as string;
          const to = data.to as string;
          const messages: Record<string, string> = {
            ACCEPTED: "Pesanan diterima restoran",
            PREPARING: "Pesanan sedang diproses",
            READY: "Pesanan siap dijemput driver",
            PICKED_UP: "Driver dalam perjalanan",
            DELIVERED: "Pesanan telah sampai",
            CANCELLED: "Pesanan dibatalkan",
          };
          const msg = messages[to];
          if (msg) {
            toast.success(`${code}: ${msg}`);
          }
        }
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connected", onConnected);
    socket.on("order:created", (data) => handleEvent("order:created", data));
    socket.on("order:status", (data) => handleEvent("order:status", data));
    socket.on("order:updated", (data) => handleEvent("order:updated", data));

    // If already connected (socket reused), set state immediately
    if (socket.connected) setIsConnected(true);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connected", onConnected);
      socket.off("order:created");
      socket.off("order:status");
      socket.off("order:updated");
      socketRefCount--;
      if (socketRefCount === 0 && socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }
    };
  }, [user, autoToast]);

  return { isConnected, lastEvent };
}

/**
 * Convenience: subscribe + auto-refetch pada event.
 * Hook ini return `tick` yang increment setiap kali event relevan masuk.
 * Caller pass `tick` sebagai dependency ke useEffect untuk refetch.
 */
export function useRealtimeTick(events?: RealtimeOrderEvent["event"][]): {
  tick: number;
  isConnected: boolean;
} {
  const [tick, setTick] = useState(0);
  const { isConnected } = useOrderSocket({
    autoToast: false,
    onEvent: useCallback((event) => {
      if (!events || events.includes(event)) {
        setTick((t) => t + 1);
      }
    }, [events]),
  });
  return { tick, isConnected };
}
