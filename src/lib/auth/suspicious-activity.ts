/**
 * Suspicious activity detection service.
 *
 * Mendeteksi pola serangan berdasarkan frekuensi kegagalan transaksi.
 * Jika user terlalu banyak gagal dalam waktu singkat → flag account.
 *
 * Trigger flag:
 *  - 5+ PIN verification failed dalam 1 jam
 *  - 3+ payment failures dalam 10 menit
 *  - 3+ wallet debit failures (insufficient balance) dalam 10 menit
 *  - Login brute force dari IP berbeda (sudah ditangani rate-limiter login)
 *
 * Setelah flagged:
 *  - User tidak bisa login (login API check isFlagged)
 *  - Admin harus unflag manual via admin panel
 *  - Audit log otomatis tercatat
 */
import { db } from "@/lib/db";
import { logAction } from "@/lib/auth/audit";

interface SuspicionBucket {
  pinFailures: number;
  paymentFailures: number;
  walletDebitFailures: number;
  windowStart: number;
}

const WINDOW_MS = 60 * 60 * 1000; // 1 jam
const store: Map<string, SuspicionBucket> = (globalThis as unknown as {
  __rejoSuspicionStore?: Map<string, SuspicionBucket>;
}).__rejoSuspicionStore ?? new Map<string, SuspicionBucket>();
(globalThis as unknown as { __rejoSuspicionStore?: Map<string, SuspicionBucket> }).__rejoSuspicionStore = store;

// Threshold untuk auto-flag
const PIN_FAILURE_THRESHOLD = 5;        // 5 PIN salah dalam 1 jam
const PAYMENT_FAILURE_THRESHOLD = 3;    // 3 payment gagal dalam 10 menit
const WALLET_DEBIT_FAILURE_THRESHOLD = 3; // 3 wallet debit gagal dalam 10 menit

function getBucket(userId: string): SuspicionBucket {
  const now = Date.now();
  let bucket = store.get(userId);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    bucket = {
      pinFailures: 0,
      paymentFailures: 0,
      walletDebitFailures: 0,
      windowStart: now,
    };
    store.set(userId, bucket);
  }
  return bucket;
}

/**
 * Record PIN verification failure.
 * Jika exceed threshold, auto-flag user.
 */
export async function recordPinFailure(userId: string, ipAddress: string | null): Promise<{ flagged: boolean }> {
  const bucket = getBucket(userId);
  bucket.pinFailures++;

  if (bucket.pinFailures >= PIN_FAILURE_THRESHOLD) {
    await flagUser(
      userId,
      `Auto-flag: ${bucket.pinFailures} PIN verification failures dalam 1 jam (threshold: ${PIN_FAILURE_THRESHOLD}).`,
      ipAddress,
    );
    return { flagged: true };
  }
  return { flagged: false };
}

/**
 * Record payment failure.
 * Jika exceed threshold, auto-flag user.
 */
export async function recordPaymentFailure(userId: string, ipAddress: string | null, reason: string): Promise<{ flagged: boolean }> {
  const bucket = getBucket(userId);
  bucket.paymentFailures++;

  if (bucket.paymentFailures >= PAYMENT_FAILURE_THRESHOLD) {
    await flagUser(
      userId,
      `Auto-flag: ${bucket.paymentFailures} payment failures dalam 1 jam (last reason: ${reason}).`,
      ipAddress,
    );
    return { flagged: true };
  }
  return { flagged: false };
}

/**
 * Record wallet debit failure.
 * Jika exceed threshold, auto-flag user.
 */
export async function recordWalletDebitFailure(userId: string, ipAddress: string | null, reason: string): Promise<{ flagged: boolean }> {
  const bucket = getBucket(userId);
  bucket.walletDebitFailures++;

  if (bucket.walletDebitFailures >= WALLET_DEBIT_FAILURE_THRESHOLD) {
    await flagUser(
      userId,
      `Auto-flag: ${bucket.walletDebitFailures} wallet debit failures dalam 1 jam (last reason: ${reason}).`,
      ipAddress,
    );
    return { flagged: true };
  }
  return { flagged: false };
}

/**
 * Flag user — set isFlagged=true + flagReason.
 * User tidak bisa login sampai admin unflag.
 */
async function flagUser(userId: string, reason: string, ipAddress: string | null): Promise<void> {
  // Cek apakah user sudah flagged (jangan double-flag)
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isFlagged: true, email: true, role: true },
  });
  if (!user || user.isFlagged) return;

  await db.user.update({
    where: { id: userId },
    data: {
      isFlagged: true,
      flagReason: reason,
    },
  });

  // Revoke semua session aktif (force logout)
  await db.session.deleteMany({
    where: { userId },
  }).catch(() => {});

  await logAction({
    actorId: userId,
    actorEmail: user.email,
    actorRole: user.role,
    category: "security",
    action: "security.user_auto_flagged",
    description: `User di-flag otomatis: ${reason}`,
    outcome: "success",
    ipAddress,
    metadata: { reason, autoFlagged: true },
  });

  // Reset bucket setelah flag
  store.delete(userId);
}

/**
 * Reset failure counters setelah transaksi sukses.
 * Dipanggil saat PIN verification sukses atau payment sukses.
 */
export function resetFailures(userId: string): void {
  store.delete(userId);
}

/**
 * Admin: unflag user (manual review).
 */
export async function unflagUser(adminId: string, adminEmail: string, userId: string, ipAddress: string | null): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      isFlagged: false,
      flagReason: null,
    },
  });

  store.delete(userId);

  await logAction({
    actorId: adminId,
    actorEmail: adminEmail,
    actorRole: "ADMIN",
    category: "security",
    action: "security.user_unflagged",
    description: `User ${userId} di-unflag oleh admin.`,
    targetId: userId,
    targetType: "user",
    outcome: "success",
    ipAddress,
  });
}
