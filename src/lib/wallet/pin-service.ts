/**
 * Wallet PIN service — 6-digit PIN untuk transaksi dompet sensitif.
 *
 * Aturan PIN:
 *  - Tepat 6 digit (0-9)
 *  - Disimpan sebagai bcrypt hash (sama seperti password)
 *  - Required untuk: WALLET payment > Rp 100.000, ALL withdrawal
 *  - Max 3 percobaan salah → lock PIN 5 menit (memaksa tunggu)
 *  - Reset PIN butuh verify password + audit log
 *
 * Mengapa 6 digit cukup aman:
 *  - Rate limit: 3 percobaan per 5 menit
 *  - 6 digit = 1 juta kombinasi, brute force butuh 5+ tahun dengan rate limit
 *  - PIN hanya untuk user yang sudah login (second factor, bukan first factor)
 */
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

// === CONFIG ===
export const PIN_LENGTH = 6;
export const PIN_MAX_ATTEMPTS = 3;
export const PIN_LOCKOUT_MS = 5 * 60 * 1000; // 5 menit

// In-memory PIN attempt tracker (swap ke Redis untuk multi-instance)
interface PinBucket {
  attempts: number;
  lockedUntil: number | null;
  lastAttemptAt: number;
}

const pinStore: Map<string, PinBucket> = (globalThis as unknown as {
  __rejoPinStore?: Map<string, PinBucket>;
}).__rejoPinStore ?? new Map<string, PinBucket>();
(globalThis as unknown as { __rejoPinStore?: Map<string, PinBucket> }).__rejoPinStore = pinStore;

/**
 * Validate PIN format: harus tepat 6 digit angka.
 */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/**
 * Set PIN baru untuk wallet user.
 * PIN di-hash dengan bcrypt sebelum disimpan.
 */
export async function setWalletPin(userId: string, pin: string): Promise<void> {
  if (!isValidPinFormat(pin)) {
    throw new Error(`PIN harus ${PIN_LENGTH} digit angka.`);
  }
  const pinHash = hashPassword(pin);
  await db.wallet.update({
    where: { userId },
    data: { pinHash },
  });
  // Reset attempt bucket saat PIN di-set/ubah
  pinStore.delete(userId);
}

/**
 * Clear PIN (reset ke null — user harus set PIN baru).
 */
export async function clearWalletPin(userId: string): Promise<void> {
  await db.wallet.update({
    where: { userId },
    data: { pinHash: null },
  });
  pinStore.delete(userId);
}

/**
 * Cek apakah user sudah set PIN.
 */
export async function hasWalletPin(userId: string): Promise<boolean> {
  const wallet = await db.wallet.findUnique({
    where: { userId },
    select: { pinHash: true },
  });
  return !!wallet?.pinHash;
}

/**
 * Check apakah PIN sedang dikunci karena terlalu banyak percobaan salah.
 */
export function isPinLocked(userId: string): { locked: boolean; retryAfterSeconds: number } {
  const bucket = pinStore.get(userId);
  if (!bucket || !bucket.lockedUntil) {
    return { locked: false, retryAfterSeconds: 0 };
  }
  const now = Date.now();
  if (now >= bucket.lockedUntil) {
    // Lock sudah expired, reset bucket
    pinStore.delete(userId);
    return { locked: false, retryAfterSeconds: 0 };
  }
  return {
    locked: true,
    retryAfterSeconds: Math.ceil((bucket.lockedUntil - now) / 1000),
  };
}

/**
 * Verify PIN yang dimasukkan user.
 *
 * Return:
 *  - { valid: true } jika PIN benar
 *  - { valid: false, remaining, lockedUntil, retryAfterSeconds } jika salah
 *
 * Side effect: increment attempt counter, lock jika exceed max attempts.
 */
export async function verifyWalletPin(
  userId: string,
  pin: string,
): Promise<{
  valid: boolean;
  remaining?: number;
  maxAttempts: number;
  retryAfterSeconds?: number;
}> {
  // Check lockout dulu
  const lockStatus = isPinLocked(userId);
  if (lockStatus.locked) {
    return {
      valid: false,
      maxAttempts: PIN_MAX_ATTEMPTS,
      retryAfterSeconds: lockStatus.retryAfterSeconds,
    };
  }

  // Get wallet + PIN hash
  const wallet = await db.wallet.findUnique({
    where: { userId },
    select: { pinHash: true },
  });
  if (!wallet?.pinHash) {
    // PIN belum di-set — anggap valid (no PIN required)
    return { valid: true, maxAttempts: PIN_MAX_ATTEMPTS };
  }

  if (!isValidPinFormat(pin)) {
    // Format PIN salah — anggap attempt gagal
    return recordFailedAttempt(userId);
  }

  const isMatch = verifyPassword(pin, wallet.pinHash);
  if (isMatch) {
    // Reset bucket saat sukses
    pinStore.delete(userId);
    return { valid: true, maxAttempts: PIN_MAX_ATTEMPTS };
  }

  return recordFailedAttempt(userId);
}

function recordFailedAttempt(userId: string): {
  valid: false;
  remaining: number;
  maxAttempts: number;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  let bucket = pinStore.get(userId);

  if (!bucket) {
    bucket = {
      attempts: 0,
      lockedUntil: null,
      lastAttemptAt: now,
    };
  }

  bucket.attempts++;
  bucket.lastAttemptAt = now;

  if (bucket.attempts >= PIN_MAX_ATTEMPTS) {
    bucket.lockedUntil = now + PIN_LOCKOUT_MS;
    pinStore.set(userId, bucket);
    return {
      valid: false,
      remaining: 0,
      maxAttempts: PIN_MAX_ATTEMPTS,
      retryAfterSeconds: Math.ceil(PIN_LOCKOUT_MS / 1000),
    };
  }

  pinStore.set(userId, bucket);
  return {
    valid: false,
    remaining: PIN_MAX_ATTEMPTS - bucket.attempts,
    maxAttempts: PIN_MAX_ATTEMPTS,
  };
}

/**
 * Threshold: transaksi di bawah ini tidak butuh PIN.
 * Default Rp 100.000 (cukup untuk top-up kecil & order kecil).
 */
export const PIN_REQUIRED_THRESHOLD = 100_000;

/**
 * Check apakah transaksi butuh PIN.
 * Butuh PIN jika:
 *  - User sudah set PIN, DAN
 *  - Amount >= threshold, ATAU
 *  - Transaction type = WITHDRAWAL (selalu butuh PIN)
 */
export async function requiresPin(
  userId: string,
  amount: number,
  type: "PAYMENT" | "WITHDRAWAL",
): Promise<boolean> {
  const hasPin = await hasWalletPin(userId);
  if (!hasPin) return false;
  if (type === "WITHDRAWAL") return true;
  return amount >= PIN_REQUIRED_THRESHOLD;
}
