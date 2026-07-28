/**
 * Server-side auth context helper.
 *
 * Resolves the current user from the session cookie. Returns null if no session,
 * session expired (absolute atau idle), atau user nonaktif.
 *
 * Side effect: throttled touch `lastActivityAt` untuk reset idle timeout admin.
 */
import { db } from "@/lib/db";
import { getTokenFromCookies } from "./session";
import { getSessionPolicy, checkSessionExpiry, TOUCH_THROTTLE_MS } from "./session-config";
import type { SafeUser } from "@/types/auth";

/**
 * Versi internal yang mengembalikan info lebih lengkap untuk audit/error handling.
 * Tidak dieksport — panggilan publik pakai getCurrentUser().
 */
async function resolveSession() {
  const token = await getTokenFromCookies();
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;

  const now = Date.now();
  const policy = getSessionPolicy(session.user.role);
  const expiry = checkSessionExpiry(
    session.expiresAt,
    session.lastActivityAt,
    policy.idleTimeoutMs,
    now,
  );

  if (expiry.expired) {
    // Hapus sesi expired dari DB + kembalikan null
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return { user: null, expiryReason: expiry.reason, sessionId: session.id, email: session.user.email, role: session.user.role };
  }

  if (!session.user.isActive) return { user: null, expiryReason: undefined };

  // Throttled touch: hanya update jika lastActivityAt lebih tua dari 1 menit
  // Ini menghemat DB write tapi tetap mereset idle timeout untuk aktivitas berkelanjutan
  if (
    !session.lastActivityAt ||
    now - session.lastActivityAt.getTime() > TOUCH_THROTTLE_MS
  ) {
    await db.session.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date(now) },
    }).catch(() => {}); // Best-effort
  }

  // Strip sensitive fields
  const { passwordHash, ...safe } = session.user;
  return { user: safe, expiryReason: undefined };
}

export async function getCurrentUser() {
  const result = await resolveSession();
  return result?.user ?? null;
}

/**
 * Konversi user Prisma ke SafeUser (tanpa passwordHash).
 * Dipakai oleh API routes yang sudah fetch manual tapi perlu strip field sensitif.
 */
export function toSafeUser(user: {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: "CUSTOMER" | "MERCHANT" | "DRIVER" | "ADMIN";
  avatarUrl: string | null;
  isActive: boolean;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
  };
}

/**
 * Guard untuk API route admin.
 *
 * Pola pemakaian:
 * ```ts
 * export async function GET() {
 *   const admin = await requireAdmin();
 *   if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 *   // ... logic admin di sini, admin sudah pasti role ADMIN
 * }
 * ```
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

/** Guard untuk role spesifik lainnya. */
export async function requireRole(role: "CUSTOMER" | "MERCHANT" | "DRIVER" | "ADMIN") {
  const user = await getCurrentUser();
  if (!user || user.role !== role) return null;
  return user;
}

/**
 * Ambil info sesi saat ini untuk UI countdown.
 * Mengembalikan expiresAt + idleExpiresAt (jika idle timeout aktif).
 */
export async function getSessionInfo() {
  const token = await getTokenFromCookies();
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;

  const now = Date.now();
  const policy = getSessionPolicy(session.user.role);
  const expiry = checkSessionExpiry(
    session.expiresAt,
    session.lastActivityAt,
    policy.idleTimeoutMs,
    now,
  );

  if (expiry.expired) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (!session.user.isActive) return null;

  // Idle expiry = lastActivityAt + idleTimeoutMs (atau null jika tanpa idle timeout)
  const idleExpiresAt =
    policy.idleTimeoutMs !== null && session.lastActivityAt
      ? new Date(session.lastActivityAt.getTime() + policy.idleTimeoutMs)
      : null;

  return {
    user: toSafeUser(session.user),
    expiresAt: session.expiresAt.toISOString(),
    idleExpiresAt: idleExpiresAt?.toISOString() ?? null,
    absoluteTtlMs: policy.absoluteTtlMs,
    idleTimeoutMs: policy.idleTimeoutMs,
  };
}
