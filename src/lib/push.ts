/**
 * Web Push notification helper.
 *
 * Uses VAPID (Voluntary Application Server Identification) keys for auth.
 * Generate keys: npx web-push generate-vapid-keys
 *
 * Env:
 *  VAPID_PUBLIC_KEY  — public key (safe to expose to client)
 *  VAPID_PRIVATE_KEY — private key (server only)
 *  VAPID_SUBJECT     — mailto: or URL (default: mailto:admin@rejofood.id)
 */
import webpush from "web-push";
import { db } from "@/lib/db";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@rejofood.id";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  }
}

export function isPushConfigured(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

/**
 * Send push notification to a specific user (all their devices).
 * Best-effort — failures are logged but don't block the main operation.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!isPushConfigured()) return;

  ensureConfigured();

  const subs = await db.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icon.svg",
    badge: payload.badge || "/icon.svg",
    tag: payload.tag || "rejofood-order",
    data: {
      url: "/",
      ...payload.data,
    },
    actions: payload.actions,
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        message,
      ),
    ),
  );

  // Remove expired/invalid subscriptions
  const invalidIds: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const error = result.reason;
      // 404 = subscription expired, 410 = gone
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        invalidIds.push(subs[index].id);
      }
    }
  });

  if (invalidIds.length > 0) {
    await db.pushSubscription.deleteMany({ where: { id: { in: invalidIds } } }).catch(() => {});
  }
}

/**
 * Send order status notification to customer + merchant + driver.
 */
export async function sendOrderStatusPush(params: {
  orderCode: string;
  from: string;
  to: string;
  customerUserId: string;
  merchantUserId: string;
  driverUserId?: string | null;
  actorRole: string;
}): Promise<void> {
  const { orderCode, to, customerUserId, merchantUserId, driverUserId } = params;

  const messages: Record<string, { title: string; body: string; userId: string }> = {
    ACCEPTED: {
      title: "Pesanan diterima! 🍳",
      body: `${orderCode}: Restoran sedang menyiapkan pesananmu.`,
      userId: customerUserId,
    },
    PREPARING: {
      title: "Pesanan diproses ⏳",
      body: `${orderCode}: Makananmu sedang dimasak.`,
      userId: customerUserId,
    },
    READY: {
      title: "Pesanan siap! 📦",
      body: `${orderCode}: Menunggu driver menjemput.`,
      userId: customerUserId,
    },
    PICKED_UP: {
      title: "Driver dalam perjalanan! 🛵",
      body: `${orderCode}: Driver sedang mengantar pesananmu.`,
      userId: customerUserId,
    },
    DELIVERED: {
      title: "Pesanan tiba! 🎉",
      body: `${orderCode}: Pesananmu sudah sampai. Beri penilaian ya!`,
      userId: customerUserId,
    },
    CANCELLED: {
      title: "Pesanan dibatalkan ❌",
      body: `${orderCode}: Pesanan telah dibatalkan.`,
      userId: customerUserId,
    },
  };

  const msg = messages[to];
  if (!msg) return;

  // Notify customer
  await sendPushToUser(msg.userId, {
    title: msg.title,
    body: msg.body,
    tag: `order-${orderCode}`,
    data: { orderCode, status: to },
  });

  // Notify merchant on PICKED_UP + DELIVERED
  if (to === "PICKED_UP" || to === "DELIVERED") {
    await sendPushToUser(merchantUserId, {
      title: to === "DELIVERED" ? "Order selesai ✅" : "Driver mengambil order 🛵",
      body: `${orderCode}: ${to === "DELIVERED" ? "Pesanan telah sampai ke customer." : "Driver sedang mengantar."}`,
      tag: `order-${orderCode}`,
      data: { orderCode, status: to },
    });
  }

  // Notify driver on READY (new order available)
  if (to === "READY") {
    // Broadcast to all drivers is handled via realtime, but we can't push to all drivers here
    // Only push to assigned driver if any
    if (driverUserId) {
      await sendPushToUser(driverUserId, {
        title: "Order siap dijemput 📦",
        body: `${orderCode}: Restoran sudah siap, jemput sekarang!`,
        tag: `order-${orderCode}`,
        data: { orderCode, status: to },
      });
    }
  }
}

/**
 * Send new order notification to merchant.
 */
export async function sendNewOrderPush(merchantUserId: string, orderCode: string, customerName: string, total: number): Promise<void> {
  await sendPushToUser(merchantUserId, {
    title: "Pesanan baru! 🔔",
    body: `${orderCode}: ${customerName} memesan Rp ${total.toLocaleString("id-ID")}`,
    tag: `order-${orderCode}`,
    data: { orderCode, type: "new_order" },
  });
}
