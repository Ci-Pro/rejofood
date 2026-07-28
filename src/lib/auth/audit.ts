/**
 * Audit log helper — jejak forensik untuk semua aksi sensitif.
 *
 * Filosofi:
 *  - Append-only: tidak ada update/delete dari app. Hanya DBA yang boleh purge untuk retensi.
 *  - Best-effort: kalau insert gagal (mis. DB down), JANGAN block aksi utama.
 *    Audit log bukan sumber kebenaran, bukan penghalang. Catat error ke console.
 *  - Self-contained: logAction() menerima semua info yang dibutuhkan, tidak query user lagi.
 *
 * Konvensi action naming: `<category>.<verb>.<outcome?>`
 *   Contoh:
 *     - "auth.login.success"
 *     - "auth.login.failed"
 *     - "auth.2fa.setup"
 *     - "auth.2fa.verify.success"
 *     - "auth.logout"
 *     - "auth.register.success"
 *     - "auth.register.denied"  (admin self-register attempt)
 *     - "admin.user.ban"
 *     - "admin.user.unban"
 *     - "admin.merchant.verify"
 *
 * Outcome values: "success" | "failure" | "denied"
 *   - success = aksi berhasil
 *   - failure = aksi gagal (mis. password salah)
 *   - denied  = aksi ditolak oleh sistem (mis. role tidak punya izin)
 */
import { db } from "@/lib/db";
import { Role } from "@prisma/client";

export interface AuditLogInput {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: Role | null;
  category: string;
  action: string;
  targetId?: string | null;
  targetType?: string | null;
  description: string;
  metadata?: Record<string, unknown> | null;
  outcome?: "success" | "failure" | "denied";
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Catat aksi ke AuditLog. Non-blocking — error ditelan (log to console).
 *
 * @returns Promise<void> — resolve selalu, bahkan jika insert gagal.
 */
export async function logAction(input: AuditLogInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        actorRole: input.actorRole ?? null,
        category: input.category,
        action: input.action,
        targetId: input.targetId ?? null,
        targetType: input.targetType ?? null,
        description: input.description,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        outcome: input.outcome ?? "success",
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    // ⚠️ Audit log failure TIDAK boleh block aksi utama.
    // Log to console untuk debugging; di production, kirim ke Sentry/Datadog.
    console.error("[audit] failed to log action:", input.action, err);
  }
}

/**
 * Ekstrak info dasar dari Request untuk audit log (IP + User-Agent).
 */
export function getRequestMeta(req: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const xff = req.headers.get("x-forwarded-for");
  const ip = xff ? xff.split(",")[0].trim() : (req.headers.get("x-real-ip")?.trim() ?? null);
  return {
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") ?? null,
  };
}

// ============================================================
// QUERY HELPERS (untuk AdminDashboard viewer)
// ============================================================

export interface AuditLogQuery {
  limit?: number;
  cursor?: string; // ID AuditLog terakhir di halaman sebelumnya (cursor-based pagination)
  category?: string;
  action?: string;
  actorId?: string;
  outcome?: string;
  /** Filter by email (case-insensitive partial match) */
  email?: string;
  /** Filter ISO date range */
  from?: string;
  to?: string;
}

export interface AuditLogListItem {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  category: string;
  action: string;
  targetId: string | null;
  targetType: string | null;
  description: string;
  outcome: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogListResult {
  items: AuditLogListItem[];
  nextCursor: string | null;
  total: number;
}

/**
 * Query audit logs dengan filter + cursor pagination.
 * Hanya dipanggil dari admin-only endpoint (verifikasi via requireAdmin()).
 */
export async function listAuditLogs(query: AuditLogQuery): Promise<AuditLogListResult> {
  const limit = Math.min(query.limit ?? 50, 200);
  const where: Record<string, unknown> = {};

  if (query.category) where.category = query.category;
  if (query.action) where.action = query.action;
  if (query.actorId) where.actorId = query.actorId;
  if (query.outcome) where.outcome = query.outcome;
  if (query.email) where.actorEmail = { contains: query.email };
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to) where.createdAt.lte = new Date(query.to);
  }

  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1, // ambil 1 ekstra untuk cek nextCursor
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
    db.auditLog.count({ where }),
  ]);

  let nextCursor: string | null = null;
  if (items.length > limit) {
    nextCursor = items[items.length - 1].id;
    items.pop(); // hapus item ekstra
  }

  return {
    items: items.map((i) => ({
      ...i,
      actorRole: i.actorRole as string | null,
      metadata: i.metadata ? (JSON.parse(i.metadata) as Record<string, unknown>) : null,
      createdAt: i.createdAt.toISOString(),
    })),
    nextCursor,
    total,
  };
}

/**
 * Daftar kategori unik — untuk dropdown filter di AdminDashboard.
 */
export async function listAuditCategories(): Promise<string[]> {
  const results = await db.auditLog.findMany({
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return results.map((r) => r.category);
}
