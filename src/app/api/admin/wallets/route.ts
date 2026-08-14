/**
 * GET /api/admin/wallets
 *
 * List semua wallet untuk admin monitoring.
 * Support search by email + filter by role + sort.
 *
 * Query: ?page=1&limit=20&search=&role=CUSTOMER&frozen=false
 */
import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/context";

export async function GET(req: Request) {
  const me = await requireRole("ADMIN");
  if (!me) {
    return NextResponse.json({ error: "Forbidden. Admin only." }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
  const search = url.searchParams.get("search")?.trim() ?? "";
  const roleParam = url.searchParams.get("role");
  const frozen = url.searchParams.get("frozen");

  const where: Prisma.WalletWhereInput = {};

  if (search || (roleParam && Object.values(Role).includes(roleParam as Role))) {
    where.user = {};
    if (search) {
      where.user.OR = [
        { email: { contains: search } },
        { fullName: { contains: search } },
      ];
    }
    if (roleParam && Object.values(Role).includes(roleParam as Role)) {
      where.user.role = roleParam as Role;
    }
  }
  if (frozen === "true") where.isFrozen = true;
  if (frozen === "false") where.isFrozen = false;

  const [wallets, total] = await Promise.all([
    db.wallet.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            avatarUrl: true,
            isActive: true,
          },
        },
        _count: { select: { transactions: true } },
      },
    }),
    db.wallet.count({ where }),
  ]);

  // Aggregate stats
  const totalBalanceAgg = await db.wallet.aggregate({ _sum: { balance: true } });
  const frozenCount = await db.wallet.count({ where: { isFrozen: true } });

  return NextResponse.json({
    items: wallets.map((w) => ({
      id: w.id,
      userId: w.userId,
      balance: w.balance,
      isFrozen: w.isFrozen,
      hasPin: !!w.pinHash,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      txCount: w._count.transactions,
      user: w.user,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    stats: {
      totalBalance: totalBalanceAgg._sum.balance ?? 0,
      walletCount: total,
      frozenCount,
    },
  });
}
