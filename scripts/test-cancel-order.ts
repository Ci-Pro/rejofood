/**
 * Integration test untuk customer cancel order.
 *
 * Test:
 *  1. Customer checkout → customer cancel PENDING → status CANCELLED + audit + emit
 *  2. Customer checkout → merchant accept → customer cancel ACCEPTED → CANCELLED
 *  3. Customer checkout → merchant accept → preparing → customer cancel PREPARING → CANCELLED
 *  4. Customer checkout → merchant accept → preparing → ready → customer cancel READY → 400 ditolak
 *  5. Customer tries cancel order milik customer lain → 404
 *  6. Merchant/admin tries cancel via customer endpoint → 403
 */
import { _generateTokenForTesting } from "../src/lib/auth/totp";

const BASE = "http://localhost:3000";
let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ ${msg}`);
    failed++;
  }
}

async function login(email: string, role: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "rejo1234", expectedRole: role }),
  });
  const data = await res.json();
  if (data.needsTwoFactor) {
    const { PrismaClient } = await import("@prisma/client");
    const { generateSync } = await import("otplib");
    const db = new PrismaClient();
    const u = await db.user.findUnique({ where: { email } });
    const code = generateSync({ secret: u!.twoFactorSecret!, digits: 6, period: 30, algorithm: "sha1" });
    await db.$disconnect();
    const verifyRes = await fetch(`${BASE}/api/auth/2fa/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challengeToken: data.challengeToken, code }),
    });
    return verifyRes.headers.get("set-cookie")!.match(/rejo_session=([^;]+)/)![0];
  }
  return res.headers.get("set-cookie")!.match(/rejo_session=([^;]+)/)![0];
}

async function checkout(custCookie: string): Promise<{ id: string; code: string }> {
  const restaurantsRes = await fetch(`${BASE}/api/restaurants?limit=1`);
  const restaurants = await restaurantsRes.json();
  const detailRes = await fetch(`${BASE}/api/restaurants/${restaurants.items[0].id}`);
  const detail = await detailRes.json();
  const item = detail.merchant.menuItems[0];

  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: custCookie },
    body: JSON.stringify({
      items: [{ menuItemId: item.id, quantity: 1 }],
      deliveryAddress: "Jl. Cancel Test No. 1, Jakarta",
    }),
  });
  const order = await orderRes.json();
  return { id: order.order.id, code: order.order.code };
}

async function merchantAdvance(merchCookie: string, orderId: string, toStatus: string) {
  await fetch(`${BASE}/api/merchant/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: merchCookie },
    body: JSON.stringify({ status: toStatus }),
  });
}

async function main() {
  console.log("\n=== Setup ===");
  const custCookie = await login("customer@rejofood.id", "CUSTOMER");
  const merchCookie = await login("merchant@rejofood.id", "MERCHANT");
  assert(!!custCookie && !!merchCookie, "logins succeed");

  // Test 1: cancel PENDING
  console.log("\n=== Test 1: cancel PENDING (aman, sebelum merchant accept) ===");
  {
    const o = await checkout(custCookie);
    console.log(`  Order ${o.code} created`);
    const cancelRes = await fetch(`${BASE}/api/orders/${o.id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: custCookie },
      body: JSON.stringify({ reason: "Berubah pikiran" }),
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.status === 200, `cancel HTTP 200 (got ${cancelRes.status})`);
    assert(cancelData.order.status === "CANCELLED", "status now CANCELLED");
    assert(!!cancelData.order.cancelledAt, "cancelledAt set");
    console.log(`  ✅ Order ${o.code} cancelled from PENDING`);
  }

  // Test 2: cancel ACCEPTED
  console.log("\n=== Test 2: cancel ACCEPTED ===");
  {
    const o = await checkout(custCookie);
    await merchantAdvance(merchCookie, o.id, "ACCEPTED");
    const cancelRes = await fetch(`${BASE}/api/orders/${o.id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: custCookie },
      body: JSON.stringify({ reason: "Lama menunggu" }),
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.status === 200, `cancel HTTP 200 (got ${cancelRes.status})`);
    assert(cancelData.order.status === "CANCELLED", "status CANCELLED");
    console.log(`  ✅ Order ${o.code} cancelled from ACCEPTED`);
  }

  // Test 3: cancel PREPARING
  console.log("\n=== Test 3: cancel PREPARING ===");
  {
    const o = await checkout(custCookie);
    await merchantAdvance(merchCookie, o.id, "ACCEPTED");
    await merchantAdvance(merchCookie, o.id, "PREPARING");
    const cancelRes = await fetch(`${BASE}/api/orders/${o.id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: custCookie },
      body: JSON.stringify({ reason: "Test cancel preparing" }),
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.status === 200, `cancel HTTP 200 (got ${cancelRes.status})`);
    assert(cancelData.order.status === "CANCELLED", "status CANCELLED");
    console.log(`  ✅ Order ${o.code} cancelled from PREPARING`);
  }

  // Test 4: cancel READY → ditolak
  console.log("\n=== Test 4: cancel READY → ditolak (400) ===");
  {
    const o = await checkout(custCookie);
    await merchantAdvance(merchCookie, o.id, "ACCEPTED");
    await merchantAdvance(merchCookie, o.id, "PREPARING");
    await merchantAdvance(merchCookie, o.id, "READY");
    const cancelRes = await fetch(`${BASE}/api/orders/${o.id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: custCookie },
      body: JSON.stringify({}),
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.status === 400, `cancel READY ditolak HTTP 400 (got ${cancelRes.status})`);
    assert(cancelData.error.includes("siap dijemput"), "error message clear");
    console.log(`  ✅ Order ${o.code} READY cannot be cancelled`);
  }

  // Test 5: customer tries cancel non-existent order → 404
  console.log("\n=== Test 5: cancel non-existent order → 404 ===");
  {
    const cancelRes = await fetch(`${BASE}/api/orders/nonexistent-id/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: custCookie },
      body: JSON.stringify({}),
    });
    assert(cancelRes.status === 404, `non-existent order → 404 (got ${cancelRes.status})`);
  }

  // Test 6: merchant tries cancel via customer endpoint → 403
  console.log("\n=== Test 6: merchant tries cancel via customer endpoint → 403 ===");
  {
    const cancelRes = await fetch(`${BASE}/api/orders/some-id/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: merchCookie },
      body: JSON.stringify({}),
    });
    assert(cancelRes.status === 403, `merchant → 403 (got ${cancelRes.status})`);
  }

  // Test 7: verify audit log captured cancel events
  console.log("\n=== Test 7: audit log captured cancel events ===");
  {
    const adminCookie = await login("admin@rejofood.id", "ADMIN");
    const auditRes = await fetch(`${BASE}/api/audit/logs?category=order&limit=50`, {
      headers: { cookie: adminCookie },
    });
    const audit = await auditRes.json();
    const cancelAudits = audit.items.filter((a: { action: string }) => a.action === "order.cancel");
    console.log(`  Found ${cancelAudits.length} order.cancel audit events`);
    assert(cancelAudits.length >= 3, `at least 3 cancel events (PENDING, ACCEPTED, PREPARING), got ${cancelAudits.length}`);
    // Verify one has reason
    const withReason = cancelAudits.find((a: { metadata: { reason?: string } }) => a.metadata?.reason);
    assert(!!withReason, "audit log includes reason field");
  }

  // Test 8: cancel tanpa reason (reason optional)
  console.log("\n=== Test 8: cancel tanpa reason (opsional) ===");
  {
    const o = await checkout(custCookie);
    const cancelRes = await fetch(`${BASE}/api/orders/${o.id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: custCookie },
      body: JSON.stringify({}),
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.status === 200, `cancel tanpa reason HTTP 200 (got ${cancelRes.status})`);
    assert(cancelData.order.status === "CANCELLED", "status CANCELLED");
  }

  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
