/**
 * In-memory store untuk challenge token 2FA.
 *
 * Flow:
 *  1. User login dengan password (factor 1) → server buat challenge token
 *  2. Challenge token disimpan di sini dengan TTL 5 menit, mengikat userId + tipe challenge
 *  3. User submit TOTP code → server cari challenge token, verify code, baru set session cookie
 *
 * Kenapa di-memory, bukan JWT?
 *  - JWT stateless tidak bisa di-revoke. Karena 2FA challenge = state, in-memory lebih aman.
 *  - TTL pendek (5 menit) → tidak perlu persistence. Untuk multi-instance, pindah ke Redis.
 *
 * Tipe challenge:
 *  - "setup"    → admin pertama login, belum punya secret. Challenge untuk menyelesaikan setup.
 *  - "verify"   → admin sudah punya secret. Challenge untuk verifikasi TOTP saat login normal.
 */

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 menit

interface ChallengeEntry {
  userId: string;
  email: string;
  type: "setup" | "verify";
  /** Secret sementara untuk challenge "setup" — disimpan di sini sampai user verify. */
  pendingSecret?: string;
  createdAt: number;
  expiresAt: number;
  attempts: number; // jumlah percobaan TOTP pada challenge ini
}

const store: Map<string, ChallengeEntry> = (globalThis as unknown as {
  __rejoChallengeStore?: Map<string, ChallengeEntry>;
}).__rejoChallengeStore ?? new Map<string, ChallengeEntry>();
(globalThis as unknown as { __rejoChallengeStore?: Map<string, ChallengeEntry> }).__rejoChallengeStore = store;

let sweeperStarted = false;
function ensureSweeper() {
  if (sweeperStarted) return;
  sweeperStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, e] of store) {
      if (e.expiresAt <= now) store.delete(key);
    }
  }, 60 * 1000).unref?.();
}

function generateToken(): string {
  return `ch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export interface CreateChallengeInput {
  userId: string;
  email: string;
  type: "setup" | "verify";
  pendingSecret?: string;
}

export interface Challenge extends ChallengeEntry {
  token: string;
}

export function createChallenge(input: CreateChallengeInput): Challenge {
  ensureSweeper();
  const token = generateToken();
  const now = Date.now();
  const entry: ChallengeEntry = {
    userId: input.userId,
    email: input.email,
    type: input.type,
    pendingSecret: input.pendingSecret,
    createdAt: now,
    expiresAt: now + CHALLENGE_TTL_MS,
    attempts: 0,
  };
  store.set(token, entry);
  return { token, ...entry };
}

/** Ambil challenge tanpa mengubah state. null jika tidak ada / expired. */
export function getChallenge(token: string): Challenge | null {
  ensureSweeper();
  const e = store.get(token);
  if (!e) return null;
  if (e.expiresAt <= Date.now()) {
    store.delete(token);
    return null;
  }
  return { token, ...e };
}

/** Tandai percobaan TOTP gagal. Hapus otomatis jika > 5 percobaan (anti brute force). */
export function recordChallengeAttempt(token: string): { ok: boolean; remaining: number } {
  const e = store.get(token);
  if (!e) return { ok: false, remaining: 0 };
  e.attempts += 1;
  if (e.attempts > 5) {
    store.delete(token);
    return { ok: false, remaining: 0 };
  }
  return { ok: true, remaining: 6 - e.attempts };
}

/** Hapus challenge setelah sukses. */
export function consumeChallenge(token: string): void {
  store.delete(token);
}

/** Untuk testing/debug: reset semua challenge. */
export function _resetAllForTesting(): void {
  store.clear();
}
