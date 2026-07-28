/**
 * GET /api/auth/session
 * Returns the currently authenticated user or 401.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/context";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
    },
  });
}
