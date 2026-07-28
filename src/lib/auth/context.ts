/**
 * Server-side auth context helper.
 *
 * Resolves the current user from the session cookie. Returns null if no session.
 * Use inside server components / route handlers / middleware only.
 */
import { db } from "@/lib/db";
import { getTokenFromCookies } from "./session";
import type { SafeUser } from "@/types/auth";

export async function getCurrentUser() {
  const token = await getTokenFromCookies();
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    // Expired — clean up
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (!session.user.isActive) return null;

  // Strip sensitive fields
  const { passwordHash, ...safe } = session.user;
  return safe;
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
 *
 * Ini adalah lapisan keamanan utama — UI hiding (?admin=1) hanya obfuscation.
 * Setiap endpoint admin WAJIB memanggil ini di awal handler.
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
