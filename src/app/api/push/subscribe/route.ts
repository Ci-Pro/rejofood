/** POST /api/push/subscribe — save push subscription */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";
import { isPushConfigured } from "@/lib/push";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Push notification belum dikonfigurasi." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: "Subscription tidak valid." }, { status: 400 });
  }

  // Upsert — hapus lama jika endpoint sama
  await db.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    update: { userId: me.id, p256dh: body.keys.p256dh, auth: body.keys.auth },
    create: {
      userId: me.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    },
  });

  return NextResponse.json({ ok: true });
}
