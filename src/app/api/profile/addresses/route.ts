/**
 * Customer saved addresses API.
 * GET — list saved addresses
 * POST — add new address
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";

interface SavedAddress {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customer = await db.customer.findUnique({ where: { userId: me.id } });
  if (!customer) return NextResponse.json({ error: "Customer tidak ditemukan" }, { status: 404 });

  let addresses: SavedAddress[] = [];
  try {
    if (customer.defaultAddress) {
      const parsed = JSON.parse(customer.defaultAddress);
      if (Array.isArray(parsed)) addresses = parsed;
      else addresses = [{ id: "1", label: "Utama", address: customer.defaultAddress, isDefault: true }];
    }
  } catch {
    addresses = customer.defaultAddress
      ? [{ id: "1", label: "Utama", address: customer.defaultAddress, isDefault: true }]
      : [];
  }

  return NextResponse.json({ addresses });
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.address || typeof body.address !== "string") {
    return NextResponse.json({ error: "Address wajib diisi." }, { status: 400 });
  }

  const customer = await db.customer.findUnique({ where: { userId: me.id } });
  if (!customer) return NextResponse.json({ error: "Customer tidak ditemukan" }, { status: 404 });

  let addresses: SavedAddress[] = [];
  try {
    if (customer.defaultAddress) {
      const parsed = JSON.parse(customer.defaultAddress);
      if (Array.isArray(parsed)) addresses = parsed;
    }
  } catch { /* ignore */ }

  const newAddr: SavedAddress = {
    id: Date.now().toString(),
    label: body.label || `Alamat ${addresses.length + 1}`,
    address: body.address.trim(),
    isDefault: addresses.length === 0,
  };

  addresses.push(newAddr);

  await db.customer.update({
    where: { id: customer.id },
    data: { defaultAddress: JSON.stringify(addresses) },
  });

  return NextResponse.json({ address: newAddr }, { status: 201 });
}
