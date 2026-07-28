/**
 * GET /api/auth/session-info
 *
 * Returns: { user, expiresAt, idleExpiresAt, absoluteTtlMs, idleTimeoutMs }
 *
 * Dipakai oleh UI untuk countdown sesi admin:
 *  - absolute expiry (admin: 2 jam, lainnya: 7 hari)
 *  - idle expiry (admin: 15 menit tidak aktif, lainnya: null)
 */
import { NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/auth/context";

export async function GET() {
  const info = await getSessionInfo();
  if (!info) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json(info);
}
