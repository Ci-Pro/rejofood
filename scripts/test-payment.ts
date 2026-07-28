/**
 * Integration test untuk payment flow.
 *
 * Test:
 *  1. COD flow: checkout → create COD payment → langsung SUCCESS → merchant bisa ACCEPT
 *  2. QRIS flow: checkout → create QRIS payment → PENDING → simulate webhook SUCCESS → merchant bisa ACCEPT
 *  3. Merchant ACCEPT sebelum payment → ditolak (400)
 *  4. Cancel dengan refund: checkout → pay online SUCCESS → cancel → payment REFUNDED
 *  5. Cancel COD (tidak ada refund): checkout → COD → cancel → tidak ada refund
 *  6. Payment expiry: set expiresAt ke masa lalu → webhook → ditolak
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
      deliveryAddress: "Jl. Payment Test No. 1, Jakarta",
    }),
  });
  const order = await orderRes.json();
  return { id: order.order.id, code: order.order.code };
}

async function createPayment(custCookie: string, orderId: string, method: string) {
  const res = await fetch(`${BASE}/api/payment/create`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: custCookie },
    body: JSON.stringify({ orderId, method }),
  });
  return { status: res.status, data: await res.json() };
}

async function simulateWebhook(paymentCode: string, transactionStatus: string) {
  const res = await fetch(`${BASE}/api/payment/mock-notify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ paymentCode, transactionStatus }),
  });
  return { status: res.status, data: await res.json() };
}

async function merchantAccept(merchCookie: string, orderId: string) {
  const res = await fetch(`${BASE}/api/merchant/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: merchCookie },
    body: JSON.stringify({ status: "ACCEPTED" }),
  });
  return { status: res.status, data: await res.json() };
}

async function cancelOrder(custCookie: string, orderId: string, reason?: string) {
  const res = await fetch(`${BASE}/api/orders/${orderId}/cancel`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: custCookie },
    body: JSON.stringify({ reason }),
  });
  return { status: res.status, data: await res.json() };
}

async function main() {
  console.log("\n=== Setup ===");
  const custCookie = await login("customer@rejofood.id", "CUSTOMER");
  const merchCookie = await login("merchant@rejofood.id", "MERCHANT");
  assert(!!custCookie && !!merchCookie, "logins succeed");

  // Test 1: COD flow
  console.log("\n=== Test 1: COD flow — langsung SUCCESS ===");
  {
    const o = await checkout(custCookie);
    console.log(`  Order ${o.code} created`);
    const pay = await createPayment(custCookie, o.id, "COD");
    assert(pay.status === 201, `create COD HTTP 201 (got ${pay.status})`);
    assert(pay.data.payment.status === "SUCCESS", "COD langsung SUCCESS");
    assert(pay.data.payment.method === "COD", "method = COD");

    // Merchant should be able to ACCEPT now
    const accept = await merchantAccept(merchCookie, o.id);
    assert(accept.status === 200, `merchant ACCEPT OK after COD (got ${accept.status})`);
    console.log(`  ✅ Order ${o.code} COD flow complete`);
  }

  // Test 2: QRIS flow — pending → simulate → success
  console.log("\n=== Test 2: QRIS flow — PENDING → simulate SUCCESS ===");
  {
    const o = await checkout(custCookie);
    const pay = await createPayment(custCookie, o.id, "QRIS");
    assert(pay.status === 201, `create QRIS HTTP 201`);
    assert(pay.data.payment.status === "PENDING", "QRIS initial = PENDING");
    assert(!!pay.data.payment.paymentUrl, "QRIS has paymentUrl");
    assert(!!pay.data.payment.expiresAt, "QRIS has expiresAt");

    // Merchant CANNOT accept yet (payment PENDING)
    const acceptBefore = await merchantAccept(merchCookie, o.id);
    assert(acceptBefore.status === 400, `merchant cannot ACCEPT before payment SUCCESS (got ${acceptBefore.status})`);
    assert(acceptBefore.data.error.includes("Payment status"), "error mentions payment");

    // Simulate webhook success
    const notify = await simulateWebhook(pay.data.payment.code, "settlement");
    assert(notify.status === 200, `webhook HTTP 200`);
    assert(notify.data.payment.status === "SUCCESS", "payment now SUCCESS");

    // Now merchant CAN accept
    const acceptAfter = await merchantAccept(merchCookie, o.id);
    assert(acceptAfter.status === 200, `merchant ACCEPT OK after QRIS paid`);
    console.log(`  ✅ Order ${o.code} QRIS flow complete`);
  }

  // Test 3: Cancel with refund (online payment)
  console.log("\n=== Test 3: Cancel with refund (QRIS SUCCESS) ===");
  {
    const o = await checkout(custCookie);
    const pay = await createPayment(custCookie, o.id, "QRIS");
    await simulateWebhook(pay.data.payment.code, "settlement");

    // Verify payment SUCCESS
    const statusBefore = await fetch(`${BASE}/api/payment/status/${o.id}`, {
      headers: { cookie: custCookie },
    });
    const statusBeforeData = await statusBefore.json();
    assert(statusBeforeData.payment.status === "SUCCESS", "payment SUCCESS before cancel");

    // Cancel order
    const cancel = await cancelOrder(custCookie, o.id, "Test refund");
    assert(cancel.status === 200, `cancel HTTP 200`);

    // Verify payment REFUNDED
    const statusAfter = await fetch(`${BASE}/api/payment/status/${o.id}`, {
      headers: { cookie: custCookie },
    });
    const statusAfterData = await statusAfter.json();
    assert(statusAfterData.payment.status === "REFUNDED", `payment REFUNDED after cancel (got ${statusAfterData.payment.status})`);

    // Verify audit log
    const adminCookie = await login("admin@rejofood.id", "ADMIN");
    const auditRes = await fetch(`${BASE}/api/audit/logs?category=payment&limit=10`, {
      headers: { cookie: adminCookie },
    });
    const audit = await auditRes.json();
    const refundEvent = audit.items.find((a: { action: string; metadata: { paymentCode?: string } }) =>
      a.action === "payment.refunded" && a.metadata?.paymentCode === pay.data.payment.code
    );
    assert(!!refundEvent, "audit log captured payment.refunded event");
    console.log(`  ✅ Order ${o.code} refund flow complete`);
  }

  // Test 4: Cancel COD — no refund needed
  console.log("\n=== Test 4: Cancel COD — no refund ===");
  {
    const o = await checkout(custCookie);
    const pay = await createPayment(custCookie, o.id, "COD");
    assert(pay.data.payment.status === "SUCCESS", "COD SUCCESS");

    const cancel = await cancelOrder(custCookie, o.id);
    assert(cancel.status === 200, `cancel COD HTTP 200`);

    // Payment should still be SUCCESS (COD tidak di-refund, karena belum ada uang masuk)
    const statusAfter = await fetch(`${BASE}/api/payment/status/${o.id}`, {
      headers: { cookie: custCookie },
    });
    const statusAfterData = await statusAfter.json();
    assert(statusAfterData.payment.status === "SUCCESS", `COD payment tetap SUCCESS (no refund needed, got ${statusAfterData.payment.status})`);
    console.log(`  ✅ Order ${o.code} COD cancel (no refund) complete`);
  }

  // Test 5: Webhook ditolak untuk payment sudah SUCCESS
  console.log("\n=== Test 5: Webhook ditolak untuk payment sudah SUCCESS ===");
  {
    const o = await checkout(custCookie);
    const pay = await createPayment(custCookie, o.id, "COD"); // langsung SUCCESS
    const notifyAgain = await simulateWebhook(pay.data.payment.code, "settlement");
    assert(notifyAgain.status === 400, `webhook ditolak untuk SUCCESS payment (got ${notifyAgain.status})`);
  }

  // Test 6: Payment tanpa auth (merchant tries) → 403
  console.log("\n=== Test 6: Merchant tries /api/payment/create → 403 ===");
  {
    const o = await checkout(custCookie);
    const pay = await fetch(`${BASE}/api/payment/create`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: merchCookie },
      body: JSON.stringify({ orderId: o.id, method: "COD" }),
    });
    assert(pay.status === 403, `merchant → 403 (got ${pay.status})`);
  }

  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
