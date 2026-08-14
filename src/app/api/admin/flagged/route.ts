/**
 * GET /api/admin/flagged — list all flagged users
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";

export async function GET() {
  const me = await requireRole("ADMIN");
  if (!me) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  try {
    const flagged = await db.user.findMany({
      where: { isFlagged: true },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isFlagged: true,
        flagReason: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ items: flagged, total: flagged.length });
  } catch (err) {
    console.error("[admin/flagged GET]", err);
    return NextResponse.json({ error: "Gagal memuat flagged users." }, { status: 500 });
  }
}
