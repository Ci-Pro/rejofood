/**
 * GET /api/audit/logs
 *
 * Admin-only endpoint untuk membaca audit log.
 *
 * Query params:
 *  - limit (default 50, max 200)
 *  - cursor (ID AuditLog terakhir untuk pagination)
 *  - category (filter, contoh: "auth")
 *  - action (filter, contoh: "auth.login.failed")
 *  - outcome (filter: success | failure | denied)
 *  - email (partial case-insensitive)
 *  - from (ISO date)
 *  - to (ISO date)
 *
 * Returns: { items, nextCursor, total }
 *
 * Kategori tersedia di endpoint terpisah: /api/audit/categories
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/context";
import { listAuditLogs } from "@/lib/auth/audit";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden. Hanya admin yang dapat membaca audit log." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const query = {
    limit: url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    action: url.searchParams.get("action") ?? undefined,
    actorId: url.searchParams.get("actorId") ?? undefined,
    outcome: url.searchParams.get("outcome") ?? undefined,
    email: url.searchParams.get("email") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  };

  const result = await listAuditLogs(query);
  return NextResponse.json(result);
}
