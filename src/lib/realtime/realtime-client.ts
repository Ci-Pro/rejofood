/**
 * Server-side helper untuk emit events ke realtime service (socket.io).
 *
 * Dipanggil dari Next.js API routes setelah order.create, order.status_change, dll.
 * Best-effort: jika realtime service down, log error tapi jangan block aksi utama
 * (sama seperti audit log — fitur tambahan, bukan penghalang).
 *
 * Rooms:
 *  - role:admin         → semua admin
 *  - role:merchant      → semua merchant (jarang dipakai, biasanya per-user)
 *  - role:driver        → semua driver (untuk broadcast READY orders)
 *  - user:{userId}      → user spesifik (customer/merchant/driver)
 */

const REALTIME_URL = process.env.REJO_REALTIME_URL || "http://localhost:3001";
const REALTIME_SECRET = process.env.REJO_REALTIME_SECRET || "dev-secret-change-in-prod";

export interface RealtimeEvent {
  event: "order:created" | "order:status" | "order:driver_assigned" | "order:updated";
  rooms: string[];
  data: Record<string, unknown>;
}

/**
 * Emit event ke realtime service. Non-blocking (best-effort).
 */
export async function emitRealtime(event: RealtimeEvent): Promise<void> {
  try {
    await fetch(`${REALTIME_URL}/emit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${REALTIME_SECRET}`,
      },
      body: JSON.stringify({
        event: event.event,
        rooms: event.rooms,
        data: event.data,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.error("[realtime-client] emit failed:", event.event, err);
  }
}

/** Helper: emit order created → notify merchant + admin */
export async function emitOrderCreated(params: {
  orderId: string;
  code: string;
  merchantUserId: string;
  customerName: string;
  total: number;
  status: string;
  itemCount: number;
}): Promise<void> {
  await emitRealtime({
    event: "order:created",
    rooms: [`user:${params.merchantUserId}`, "role:admin"],
    data: {
      orderId: params.orderId,
      code: params.code,
      customerName: params.customerName,
      total: params.total,
      status: params.status,
      itemCount: params.itemCount,
      timestamp: new Date().toISOString(),
    },
  });
}

/** Helper: emit order status change → notify customer + merchant + admin (+drivers if READY) */
export async function emitOrderStatusChange(params: {
  orderId: string;
  code: string;
  from: string;
  to: string;
  customerUserId: string;
  merchantUserId: string;
  driverUserId?: string | null;
  actorRole: string;
}): Promise<void> {
  const rooms = [
    `user:${params.customerUserId}`,
    `user:${params.merchantUserId}`,
    "role:admin",
  ];
  if (params.driverUserId) rooms.push(`user:${params.driverUserId}`);
  if (params.to === "READY") rooms.push("role:driver");

  await emitRealtime({
    event: "order:status",
    rooms,
    data: {
      orderId: params.orderId,
      code: params.code,
      from: params.from,
      to: params.to,
      actorRole: params.actorRole,
      timestamp: new Date().toISOString(),
    },
  });
}
