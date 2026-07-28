/**
 * GET /api/profile
 * Return current user's profile + role-specific data.
 *
 * PATCH /api/profile
 * Update user profile (common fields + role-specific).
 *
 * Common editable: fullName, phone, email (with uniqueness check)
 * Customer: defaultAddress
 * Driver: vehicleType, vehiclePlate
 * Merchant: (restaurant info handled by /api/merchant/profile)
 * Admin: (no role-specific user fields)
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";
import { logAction, getRequestMeta } from "@/lib/auth/audit";
import { Role } from "@prisma/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s-]{8,20}$/;

export async function GET() {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch role-specific profile
  let roleData: Record<string, unknown> = {};
  if (me.role === "CUSTOMER") {
    const c = await db.customer.findUnique({ where: { userId: me.id } });
    roleData = { defaultAddress: c?.defaultAddress ?? null };
  } else if (me.role === "DRIVER") {
    const d = await db.driver.findUnique({ where: { userId: me.id } });
    roleData = {
      vehicleType: d?.vehicleType ?? "motorcycle",
      vehiclePlate: d?.vehiclePlate ?? null,
      isOnline: d?.isOnline ?? false,
      rating: d?.rating ?? 0,
    };
  } else if (me.role === "MERCHANT") {
    const m = await db.merchant.findUnique({ where: { userId: me.id } });
    roleData = {
      merchantId: m?.id ?? null,
      restaurantName: m?.restaurantName ?? null,
    };
  } else if (me.role === "ADMIN") {
    const a = await db.admin.findUnique({ where: { userId: me.id } });
    roleData = {
      twoFactorEnabled: me.twoFactorEnabled,
      permissions: a ? JSON.parse(a.permissions) : [],
    };
  }

  return NextResponse.json({
    user: {
      id: me.id,
      email: me.email,
      phone: me.phone,
      fullName: me.fullName,
      role: me.role,
      avatarUrl: me.avatarUrl,
      isActive: me.isActive,
      createdAt: me.createdAt.toISOString(),
    },
    ...roleData,
  });
}

export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meta = getRequestMeta(req);
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  // Common fields
  const userData: Record<string, unknown> = {};
  if (typeof body.fullName === "string") {
    const name = body.fullName.trim();
    if (name.length < 2) {
      return NextResponse.json({ error: "Nama minimal 2 karakter." }, { status: 400 });
    }
    userData.fullName = name;
  }
  if (body.phone !== undefined) {
    const phone = body.phone ? String(body.phone).trim() : null;
    if (phone && !PHONE_RE.test(phone)) {
      return NextResponse.json({ error: "Format nomor HP tidak valid." }, { status: 400 });
    }
    userData.phone = phone;
  }
  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
    }
    // Check uniqueness (exclude self)
    const existing = await db.user.findUnique({ where: { email } });
    if (existing && existing.id !== me.id) {
      return NextResponse.json({ error: "Email sudah digunakan akun lain." }, { status: 409 });
    }
    userData.email = email;
  }

  // Role-specific fields
  let roleUpdateData: Record<string, unknown> | null = null;
  let roleUpdateTable: "customer" | "driver" | null = null;

  if (me.role === "CUSTOMER" && body.defaultAddress !== undefined) {
    roleUpdateData = {
      defaultAddress: body.defaultAddress ? String(body.defaultAddress).trim() : null,
    };
    roleUpdateTable = "customer";
  }

  if (me.role === "DRIVER") {
    const d: Record<string, unknown> = {};
    if (typeof body.vehicleType === "string") {
      const valid = ["motorcycle", "car", "bicycle"];
      if (!valid.includes(body.vehicleType)) {
        return NextResponse.json({ error: "Jenis kendaraan tidak valid." }, { status: 400 });
      }
      d.vehicleType = body.vehicleType;
    }
    if (body.vehiclePlate !== undefined) {
      d.vehiclePlate = body.vehiclePlate ? String(body.vehiclePlate).trim().slice(0, 20) : null;
    }
    if (Object.keys(d).length > 0) {
      roleUpdateData = d;
      roleUpdateTable = "driver";
    }
  }

  // Execute updates
  let updatedUser = me;
  if (Object.keys(userData).length > 0) {
    updatedUser = await db.user.update({
      where: { id: me.id },
      data: userData,
    });
  }

  if (roleUpdateData && roleUpdateTable === "customer") {
    await db.customer.update({
      where: { userId: me.id },
      data: roleUpdateData,
    });
  }

  if (roleUpdateData && roleUpdateTable === "driver") {
    await db.driver.update({
      where: { userId: me.id },
      data: roleUpdateData,
    });
  }

  await logAction({
    actorId: me.id,
    actorEmail: me.email,
    actorRole: me.role as Role,
    category: "auth",
    action: "profile.update",
    description: `Profil diperbarui oleh ${me.email}. Field: ${[
      ...Object.keys(userData),
      ...(roleUpdateData ? Object.keys(roleUpdateData) : []),
    ].join(", ")}.`,
    targetId: me.id,
    targetType: "user",
    outcome: "success",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      changes: { ...userData, ...(roleUpdateData ?? {}) },
    },
  });

  return NextResponse.json({
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      phone: updatedUser.phone,
      fullName: updatedUser.fullName,
      role: updatedUser.role,
      avatarUrl: updatedUser.avatarUrl,
    },
  });
}
