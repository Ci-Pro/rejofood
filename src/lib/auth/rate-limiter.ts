/**
 * Rate limiter untuk endpoint login (dan endpoint sensitif lainnya di masa depan).
 *
 * DESAIN
 * -------
 * - In-memory: cocok untuk single-instance sandbox/preview. Untuk multi-instance production,
 *   swap fungsi-fungsi `bucket` dengan Redis (`INCR` + `EXPIRE`). API-nya tetap sama.
 * - Key = `${ip}::${email}`. IP sendiri tidak cukup (NAT kantor), email sendiri tidak cukup
 *   (credential stuffing dari banyak IP). Kombinasi keduanya paling adil + efektif.
 * - Dua state per key:
 *     1) `attempts`: jumlah percobaan gagal dalam window berjalan
 *     2) `lockedUntil`: timestamp epoch ms sampai kapan key dikunci (kalau dilewati batas)
 * - Bucket dirotasi otomatis: jika `lastAttempt` lebih tua dari `WINDOW_MS`, counter reset ke 1.
 * - Pembersihan bucket kadaluwarsa dilakukan lazy (saat akses) + scheduled sweeper setiap 5 menit.
 *
 * KONFIGURASI (via env, fallback ke default aman)
 * -----------------------------------------------
 * - REJO_RATE_LIMIT_MAX_ATTEMPTS  (default 5)  → max percobaan gagal dalam window
 * - REJO_RATE_LIMIT_WINDOW_MS     (default 15 menit) → rentang waktu penghitungan
 * - REJO_RATE_LIMIT_LOCKOUT_MS    (default 30 menit) → durasi lockout setelah max tercapai
 *
 * KONTAK LAINNYA
 * --------------
 * - Limiter ini TIDAK menggantikan password hashing/2FA/audit log; ini hanya lapisan
 *   pertahanan terhadap brute force & credential stuffing.
 * - Untuk produksi: ganti ke Redis-backed limiter + tambah CAPTCHA setelah 2 kegagalan.
 */

const MAX_ATTEMPTS = parseInt(process.env.REJO_RATE_LIMIT_MAX_ATTEMPTS ?? "5", 10);
const WINDOW_MS = parseInt(process.env.REJO_RATE_LIMIT_WINDOW_MS ?? String(15 * 60 * 1000), 10);
const LOCKOUT_MS = parseInt(process.env.REJO_RATE_LIMIT_LOCKOUT_MS ?? String(30 * 60 * 1000), 10);

interface Bucket {
  attempts: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
  lockedUntil: number | null;
}

const store: Map<string, Bucket> = (globalThis as unknown as {
  __rejoRateLimitStore?: Map<string, Bucket>;
}).__rejoRateLimitStore ?? new Map<string, Bucket>();
(globalThis as unknown as { __rejoRateLimitStore?: Map<string, Bucket> }).__rejoRateLimitStore = store;

/** Sweeper interval: hapus bucket yang sudah tidak aktif > 1 jam. */
let sweeperStarted = false;
function ensureSweeper() {
  if (sweeperStarted) return;
  sweeperStarted = true;
  setInterval(() => {
    const now = Date.now();
    const maxAge = Math.max(WINDOW_MS, LOCKOUT_MS) + 60 * 60 * 1000; // +1 jam buffer
    for (const [key, b] of store) {
      if (now - b.lastAttemptAt > maxAge) store.delete(key);
    }
  }, 5 * 60 * 1000).unref?.();
}

function makeKey(ip: string, email: string): string {
  return `${ip}::${email.toLowerCase().trim()}`;
}

export interface RateLimitResult {
  ok: boolean;
  /** Sisa percobaan sebelum lockout (0 jika sudah dikunci) */
  remaining: number;
  /** Max percobaan (untuk ditampilkan di UI) */
  maxAttempts: number;
  /** Epoch ms sampai kapan dikunci, atau null */
  lockedUntil: number | null;
  /** Detik sampai lockout berakhir, untuk countdown UI */
  retryAfterSeconds: number;
}

/**
 * Cek apakah boleh mencoba login. Tidak mengubah state.
 * Selalu panggil `recordFailure()` atau `recordSuccess()` setelahnya.
 */
export function checkRateLimit(ip: string, email: string): RateLimitResult {
  ensureSweeper();
  const key = makeKey(ip, email);
  const now = Date.now();
  const b = store.get(key);

  // Bucket baru atau sudah expired → boleh, full quota
  if (!b || now - b.firstAttemptAt > WINDOW_MS) {
    return {
      ok: true,
      remaining: MAX_ATTEMPTS,
      maxAttempts: MAX_ATTEMPTS,
      lockedUntil: null,
      retryAfterSeconds: 0,
    };
  }

  // Sedang dikunci?
  if (b.lockedUntil && b.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((b.lockedUntil - now) / 1000);
    return {
      ok: false,
      remaining: 0,
      maxAttempts: MAX_ATTEMPTS,
      lockedUntil: b.lockedUntil,
      retryAfterSeconds,
    };
  }

  // Lockout sudah lewat → reset bucket
  if (b.lockedUntil && b.lockedUntil <= now) {
    store.delete(key);
    return {
      ok: true,
      remaining: MAX_ATTEMPTS,
      maxAttempts: MAX_ATTEMPTS,
      lockedUntil: null,
      retryAfterSeconds: 0,
    };
  }

  // Dalam window aktif
  const remaining = Math.max(0, MAX_ATTEMPTS - b.attempts);
  return {
    ok: remaining > 0,
    remaining,
    maxAttempts: MAX_ATTEMPTS,
    lockedUntil: null,
    retryAfterSeconds: 0,
  };
}

/**
 * Catat kegagalan login. Jika mencapai MAX_ATTEMPTS, set lockedUntil.
 * Harus dipanggil SETELAH checkRateLimit() mengembalikan ok=true.
 */
export function recordFailure(ip: string, email: string): RateLimitResult {
  const key = makeKey(ip, email);
  const now = Date.now();
  let b = store.get(key);

  if (!b || now - b.firstAttemptAt > WINDOW_MS) {
    b = {
      attempts: 0,
      firstAttemptAt: now,
      lastAttemptAt: now,
      lockedUntil: null,
    };
    store.set(key, b);
  }

  b.attempts += 1;
  b.lastAttemptAt = now;

  if (b.attempts >= MAX_ATTEMPTS) {
    b.lockedUntil = now + LOCKOUT_MS;
    return {
      ok: false,
      remaining: 0,
      maxAttempts: MAX_ATTEMPTS,
      lockedUntil: b.lockedUntil,
      retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000),
    };
  }

  return {
    ok: true,
    remaining: MAX_ATTEMPTS - b.attempts,
    maxAttempts: MAX_ATTEMPTS,
    lockedUntil: null,
    retryAfterSeconds: 0,
  };
}

/** Catat keberhasilan — hapus bucket agar user tidak terbebani history gagal lama. */
export function recordSuccess(ip: string, email: string): void {
  store.delete(makeKey(ip, email));
}

/**
 * Ekstrak IP dari Request headers. Prioritaskan X-Forwarded-For karena
 * aplikasi berjalan di belakang Caddy/gateway.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/** Untuk testing/debug: reset semua bucket. Jangan panggil di production. */
export function _resetAllForTesting(): void {
  store.clear();
}
