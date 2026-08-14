/** POST /api/push/unsubscribe — remove push subscription */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.endpoint) {
    return NextResponse.json({ error: "Endpoint wajib diisi." }, { status: 400 });
  }

  await db.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint, userId: me.id },
  });

  return NextResponse.json({ ok: true });
}
