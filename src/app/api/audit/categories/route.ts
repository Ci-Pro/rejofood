/**
 * GET /api/audit/categories
 * Returns: { categories: string[] } — daftar kategori unik di AuditLog.
 * Admin-only.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/context";
import { listAuditCategories } from "@/lib/auth/audit";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const categories = await listAuditCategories();
  return NextResponse.json({ categories });
}
