/**
 * GET /api/audit/export
 *
 * Export audit log sebagai CSV untuk admin analysis.
 *
 * Query params:
 *   ?startDate=2026-01-01&endDate=2026-12-31&category=auth&action=&outcome=&actorEmail=
 *
 * Response: CSV file download (text/csv)
 *
 * Max 10.000 rows per export (prevent memory issue).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";

const MAX_EXPORT_ROWS = 10_000;

function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  // Escape double quotes by doubling them, wrap in quotes if contains comma/newline/quote
  const escaped = value.replace(/"/g, '""');
  if (/[,\n\r"]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
}

export async function GET(req: Request) {
  const me = await requireRole("ADMIN");
  if (!me) {
    return NextResponse.json({ error: "Forbidden. Admin only." }, { status: 403 });
  }

  const url = new URL(req.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const category = url.searchParams.get("category");
  const action = url.searchParams.get("action");
  const outcome = url.searchParams.get("outcome");
  const actorEmail = url.searchParams.get("actorEmail");

  const where: {
    createdAt?: { gte?: Date; lte?: Date };
    category?: string;
    action?: { contains: string };
    outcome?: string;
    actorEmail?: { contains: string };
  } = {};

  if (startDate) {
    where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    where.createdAt = { ...where.createdAt, lte: end };
  }
  if (category) where.category = category;
  if (action) where.action = { contains: action };
  if (outcome) where.outcome = outcome;
  if (actorEmail) where.actorEmail = { contains: actorEmail };

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_EXPORT_ROWS,
    select: {
      id: true,
      createdAt: true,
      actorId: true,
      actorEmail: true,
      actorRole: true,
      category: true,
      action: true,
      targetId: true,
      targetType: true,
      description: true,
      outcome: true,
      ipAddress: true,
      userAgent: true,
    },
  });

  // Build CSV
  const headers = [
    "Timestamp",
    "Category",
    "Action",
    "Outcome",
    "Actor Email",
    "Actor Role",
    "Actor ID",
    "Target Type",
    "Target ID",
    "Description",
    "IP Address",
    "User Agent",
  ];

  const rows = logs.map((log) => [
    log.createdAt.toISOString(),
    log.category,
    log.action,
    log.outcome,
    log.actorEmail ?? "",
    log.actorRole ?? "",
    log.actorId ?? "",
    log.targetType ?? "",
    log.targetId ?? "",
    log.description,
    log.ipAddress ?? "",
    log.userAgent ?? "",
  ].map(escapeCsv).join(","));

  const csv = [headers.join(","), ...rows].join("\r\n");

  // Generate filename
  const dateStr = new Date().toISOString().slice(0, 10);
  const filtersStr = [
    startDate ? `from-${startDate}` : null,
    endDate ? `to-${endDate}` : null,
    category ? `cat-${category}` : null,
  ].filter(Boolean).join("_");
  const filename = `audit-log_${dateStr}${filtersStr ? `_${filtersStr}` : ""}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Exported-Rows": String(logs.length),
    },
  });
}
