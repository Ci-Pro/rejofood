/** DELETE /api/profile/addresses/[addrId] — delete saved address */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ addrId: string }> },
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { addrId } = await params;
  const customer = await db.customer.findUnique({ where: { userId: me.id } });
  if (!customer) return NextResponse.json({ error: "Customer tidak ditemukan" }, { status: 404 });

  let addresses: Array<{ id: string; label: string; address: string; isDefault: boolean }> = [];
  try {
    if (customer.defaultAddress) {
      const parsed = JSON.parse(customer.defaultAddress);
      if (Array.isArray(parsed)) addresses = parsed;
    }
  } catch { /* ignore */ }

  addresses = addresses.filter((a) => a.id !== addrId);

  // If deleted was default, make first remaining default
  if (addresses.length > 0 && !addresses.some((a) => a.isDefault)) {
    addresses[0].isDefault = true;
  }

  await db.customer.update({
    where: { id: customer.id },
    data: { defaultAddress: JSON.stringify(addresses) },
  });

  return NextResponse.json({ ok: true });
}
