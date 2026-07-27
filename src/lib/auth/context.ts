/**
 * Server-side auth context helper.
 *
 * Resolves the current user from the session cookie. Returns null if no session.
 * Use inside server components / route handlers / middleware only.
 */
import { db } from "@/lib/db";
import { getTokenFromCookies } from "./session";

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
