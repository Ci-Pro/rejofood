/**
 * GET /api/admin/users
 * List all users with pagination + filter by role.
 *
 * Query: role (filter), limit, cursor, search (email/name)
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/context";
import { Role } from "@prisma/client";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "30", 10) || 30, 100);
  const cursor = url.searchParams.get("cursor") || undefined;
  const role = url.searchParams.get("role");
  const search = url.searchParams.get("search")?.trim();

  const where: Record<string, unknown> = {};
  if (role) where.role = role as Role;
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { fullName: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
      },
    }),
    db.user.count({ where }),
  ]);

  let nextCursor: string | null = null;
  if (items.length > limit) {
    nextCursor = items[items.length - 1].id;
    items.pop();
  }

  return NextResponse.json({
    items: items.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
    })),
    nextCursor,
    total,
  });
}
