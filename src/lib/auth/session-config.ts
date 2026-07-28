/**
 * Session TTL configuration — differentiated per role.
 *
 * Filosofi:
 *  - Admin session = harga diri seluruh sistem. Jika bocor, dampaknya masif
 *    (bisa ban user, lihat data sensitif, dll). Maka TTL dipendek + idle timeout ketat.
 *  - Customer/Merchant/Driver = nyaman dipakai sehari-hari. TTL panjang, tanpa idle timeout
 *    (tidak annoying saat mereka berbelanja/kelola toko santai).
 *
 * Konstanta:
 *  - ADMIN: 2 jam absolute TTL + 15 menit idle timeout
 *  - Lainnya: 7 hari absolute TTL, tanpa idle timeout
 *
 * Idle timeout: jika selama X menit tidak ada request authenticated, sesi dianggap expired
 * meskipun belum mencapai absolute TTL. Di-touch setiap kali getCurrentUser() dipanggil.
 */
import { Role } from "@prisma/client";

interface SessionPolicy {
  /** Absolute TTL dalam milidetik — sesi tidak boleh hidup lebih lama dari ini. */
  absoluteTtlMs: number;
  /** Idle timeout dalam milidetik — sesi expired jika tidak ada aktivitas selama ini. */
  /** null = tidak ada idle timeout (untuk role non-admin). */
  idleTimeoutMs: number | null;
}

const POLICIES: Record<Role, SessionPolicy> = {
  [Role.ADMIN]: {
    absoluteTtlMs: 1000 * 60 * 60 * 2,    // 2 jam
    idleTimeoutMs: 1000 * 60 * 15,         // 15 menit idle
  },
  [Role.MERCHANT]: {
    absoluteTtlMs: 1000 * 60 * 60 * 24 * 7, // 7 hari
    idleTimeoutMs: null,
  },
  [Role.DRIVER]: {
    absoluteTtlMs: 1000 * 60 * 60 * 24 * 7, // 7 hari
    idleTimeoutMs: null,
  },
  [Role.CUSTOMER]: {
    absoluteTtlMs: 1000 * 60 * 60 * 24 * 7, // 7 hari
    idleTimeoutMs: null,
  },
};

export function getSessionPolicy(role: Role): SessionPolicy {
  return POLICIES[role];
}

/** Hitung absolute expiry timestamp dari waktu mulai. */
export function computeAbsoluteExpiry(role: Role, startMs: number = Date.now()): Date {
  return new Date(startMs + POLICIES[role].absoluteTtlMs);
}

/**
 * Cek apakah sesi sudah expired (absolute atau idle).
 *
 * @param expiresAt       - Absolute expiry (DateTime dari DB)
 * @param lastActivityAt  - Aktivitas terakhir (DateTime atau null untuk sesi lama)
 * @param idleTimeoutMs   - Idle timeout policy (null = tanpa idle timeout)
 * @param now             - Timestamp referensi (default: Date.now())
 *
 * @returns { expired: boolean, reason?: "absolute" | "idle" }
 */
export function checkSessionExpiry(
  expiresAt: Date,
  lastActivityAt: Date | null,
  idleTimeoutMs: number | null,
  now: number = Date.now(),
): { expired: boolean; reason?: "absolute" | "idle" } {
  // Cek absolute TTL dulu
  if (expiresAt.getTime() <= now) {
    return { expired: true, reason: "absolute" };
  }
  // Cek idle timeout (hanya jika policy mengaktifkan + lastActivityAt tersedia)
  if (idleTimeoutMs !== null && lastActivityAt !== null) {
    if (lastActivityAt.getTime() + idleTimeoutMs <= now) {
      return { expired: true, reason: "idle" };
    }
  }
  return { expired: false };
}

/**
 * Threshold untuk throttling touch lastActivityAt.
 * Kita tidak update DB setiap request (boros) — hanya jika selisih > 1 menit.
 */
export const TOUCH_THROTTLE_MS = 60 * 1000; // 1 menit
