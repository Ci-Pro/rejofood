/**
 * Integration test untuk full order pipeline:
 *   customer checkout → merchant accept → preparing → ready → driver pickup → delivered
 *
 * Jalankan: bun run scripts/test-order-flow.ts
 */
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
    // Admin — get TOTP from DB
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

async function main() {
  console.log("\n=== Setup: login as customer, merchant, driver ===");
  const custCookie = await login("customer@rejofood.id", "CUSTOMER");
  const merchCookie = await login("merchant@rejofood.id", "MERCHANT");
  const driverCookie = await login("driver@rejofood.id", "DRIVER");
  assert(!!custCookie && !!merchCookie && !!driverCookie, "all 3 logins succeed");

  // Get a menu item
  console.log("\n=== Step 1: Get first restaurant + menu item ===");
  const restaurantsRes = await fetch(`${BASE}/api/restaurants?limit=1`);
  const restaurants = await restaurantsRes.json();
  const r = restaurants.items[0];
  const detailRes = await fetch(`${BASE}/api/restaurants/${r.id}`);
  const detail = await detailRes.json();
  const item = detail.merchant.menuItems[0];
  console.log(`  Restaurant: ${detail.merchant.restaurantName}`);
  console.log(`  First item: ${item.name} - Rp ${item.price}`);

  // Customer checkout
  console.log("\n=== Step 2: Customer places order ===");
  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: custCookie },
    body: JSON.stringify({
      items: [{ menuItemId: item.id, quantity: 2 }],
      deliveryAddress: "Jl. Test No. 123, Jakarta",
      notes: "Pedasnya sedang",
    }),
  });
  const order = await orderRes.json();
  assert(orderRes.status === 201, `order created HTTP 201 (got ${orderRes.status})`);
  assert(!!order.order?.code, `order code generated: ${order.order?.code}`);
  assert(order.order.status === "PENDING", "initial status = PENDING");
  assert(order.order.subtotal === item.price * 2, `subtotal = ${item.price} * 2`);
  assert(order.order.deliveryFee === 10000, "deliveryFee = 10000");
  assert(order.order.total === item.price * 2 + 10000, "total = subtotal + deliveryFee");
  const orderId = order.order.id;
  const orderCode = order.order.code;

  // Customer tries to checkout from DIFFERENT merchant — should fail
  console.log("\n=== Step 3: Cross-merchant validation ===");
  const r2 = restaurants.items[1] ?? restaurants.items[0]; // if only 1 restaurant, test same merchant
  if (restaurants.items.length > 1) {
    const detail2Res = await fetch(`${BASE}/api/restaurants/${r2.id}`);
    const detail2 = await detail2Res.json();
    const item2 = detail2.merchant.menuItems[0];
    const crossRes = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: custCookie },
      body: JSON.stringify({
        items: [
          { menuItemId: item.id, quantity: 1 },
          { menuItemId: item2.id, quantity: 1 },
        ],
        deliveryAddress: "Test",
      }),
    });
    const crossData = await crossRes.json();
    assert(crossRes.status === 400, "cross-merchant order rejected");
    assert(crossData.error.includes("restoran yang sama"), "error message clear");
  } else {
    console.log("  (skip — only 1 restaurant seeded)");
  }

  // Merchant sees the order
  console.log("\n=== Step 4: Merchant sees incoming order ===");
  const merchOrdersRes = await fetch(`${BASE}/api/merchant/orders`, {
    headers: { cookie: merchCookie },
  });
  const merchOrders = await merchOrdersRes.json();
  assert(merchOrdersRes.status === 200, "merchant orders HTTP 200");
  const found = merchOrders.items.find((o: { id: string }) => o.id === orderId);
  assert(!!found, "merchant sees the new order");
  assert(found.status === "PENDING", "merchant sees status PENDING");

  // Merchant accepts
  console.log("\n=== Step 5: Merchant accepts order ===");
  const acceptRes = await fetch(`${BASE}/api/merchant/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: merchCookie },
    body: JSON.stringify({ status: "ACCEPTED" }),
  });
  const acceptData = await acceptRes.json();
  assert(acceptRes.status === 200, "accept HTTP 200");
  assert(acceptData.order.status === "ACCEPTED", "status now ACCEPTED");
  assert(!!acceptData.order.acceptedAt, "acceptedAt set");

  // Invalid transition: ACCEPTED → READY (must go through PREPARING)
  console.log("\n=== Step 6: Invalid transition rejected ===");
  const invalidRes = await fetch(`${BASE}/api/merchant/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: merchCookie },
    body: JSON.stringify({ status: "READY" }),
  });
  assert(invalidRes.status === 400, "ACCEPTED → READY rejected (must PREPARING first)");

  // Merchant: PREPARING → READY
  console.log("\n=== Step 7: PREPARING → READY ===");
  await fetch(`${BASE}/api/merchant/orders/${orderId}/status`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: merchCookie },
    body: JSON.stringify({ status: "PREPARING" }),
  });
  // POST is wrong method, redo with PATCH
  await fetch(`${BASE}/api/merchant/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: merchCookie },
    body: JSON.stringify({ status: "PREPARING" }),
  });
  const readyRes = await fetch(`${BASE}/api/merchant/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: merchCookie },
    body: JSON.stringify({ status: "READY" }),
  });
  const readyData = await readyRes.json();
  assert(readyRes.status === 200, "READY HTTP 200");
  assert(readyData.order.status === "READY", "status now READY");

  // Driver sees available order
  console.log("\n=== Step 8: Driver sees READY order ===");
  const driverAvailRes = await fetch(`${BASE}/api/driver/orders/available`, {
    headers: { cookie: driverCookie },
  });
  const driverAvail = await driverAvailRes.json();
  assert(driverAvailRes.status === 200, "driver available HTTP 200");
  const availOrder = driverAvail.available.find((o: { id: string }) => o.id === orderId);
  assert(!!availOrder, "driver sees READY order in available list");
  assert(driverAvail.active.length === 0, "driver has no active delivery yet");

  // Driver pickup
  console.log("\n=== Step 9: Driver picks up order ===");
  const pickupRes = await fetch(`${BASE}/api/driver/orders/${orderId}/pickup`, {
    method: "POST",
    headers: { cookie: driverCookie },
  });
  const pickupData = await pickupRes.json();
  assert(pickupRes.status === 200, "pickup HTTP 200");
  assert(pickupData.order.status === "PICKED_UP", "status now PICKED_UP");
  assert(!!pickupData.order.pickedUpAt, "pickedUpAt set");

  // Driver tries to pickup again (race condition) — should fail
  console.log("\n=== Step 10: Race condition — second pickup attempt rejected ===");
  // Note: di-test dengan driver yang sama. Real race test butuh 2 driver.
  const pickupAgainRes = await fetch(`${BASE}/api/driver/orders/${orderId}/pickup`, {
    method: "POST",
    headers: { cookie: driverCookie },
  });
  assert(pickupAgainRes.status === 409, `second pickup rejected (HTTP ${pickupAgainRes.status})`);

  // Driver now has active delivery
  console.log("\n=== Step 11: Driver sees active delivery ===");
  const driverActiveRes = await fetch(`${BASE}/api/driver/orders/available`, {
    headers: { cookie: driverCookie },
  });
  const driverActive = await driverActiveRes.json();
  assert(driverActive.active.length === 1, "driver has 1 active delivery");
  assert(driverActive.active[0].id === orderId, "active delivery = our order");
  // Order should no longer be in available
  const stillAvail = driverActive.available.find((o: { id: string }) => o.id === orderId);
  assert(!stillAvail, "order removed from available list");

  // Driver deliver
  console.log("\n=== Step 12: Driver delivers order ===");
  const deliverRes = await fetch(`${BASE}/api/driver/orders/${orderId}/deliver`, {
    method: "POST",
    headers: { cookie: driverCookie },
  });
  const deliverData = await deliverRes.json();
  assert(deliverRes.status === 200, "deliver HTTP 200");
  assert(deliverData.order.status === "DELIVERED", "status now DELIVERED");

  // Customer sees order as DELIVERED
  console.log("\n=== Step 13: Customer sees order DELIVERED ===");
  const custOrdersRes = await fetch(`${BASE}/api/orders`, {
    headers: { cookie: custCookie },
  });
  const custOrders = await custOrdersRes.json();
  const custOrder = custOrders.items.find((o: { id: string }) => o.id === orderId);
  assert(!!custOrder, "customer sees order in own list");
  assert(custOrder.status === "DELIVERED", "customer sees status DELIVERED");
  assert(!!custOrder.deliveredAt, "deliveredAt visible");

  // Admin sees the order
  console.log("\n=== Step 14: Admin sees all orders ===");
  const adminCookie = await login("admin@rejofood.id", "ADMIN");
  const adminOrdersRes = await fetch(`${BASE}/api/admin/orders?limit=10`, {
    headers: { cookie: adminCookie },
  });
  const adminOrders = await adminOrdersRes.json();
  assert(adminOrdersRes.status === 200, "admin orders HTTP 200");
  const adminOrder = adminOrders.items.find((o: { id: string }) => o.id === orderId);
  assert(!!adminOrder, "admin sees the order");
  assert(adminOrder.status === "DELIVERED", "admin sees DELIVERED status");
  assert(adminOrder.customerName === "Budi Pelanggan", "admin sees customer name");
  assert(adminOrder.merchantName === "Warung Rejo Pangan", "admin sees merchant name");

  // Audit log captured all transitions
  console.log("\n=== Step 15: Audit log captured order events ===");
  const auditRes = await fetch(`${BASE}/api/audit/logs?category=order&limit=20`, {
    headers: { cookie: adminCookie },
  });
  const audit = await auditRes.json();
  const orderAudits = audit.items.filter((a: { metadata: { code?: string } }) => a.metadata?.code === orderCode);
  console.log(`  Found ${orderAudits.length} audit events for ${orderCode}:`);
  for (const a of orderAudits) {
    console.log(`    ${a.action.padEnd(28)} | ${a.description.substring(0, 70)}`);
  }
  assert(orderAudits.length >= 4, `at least 4 audit events (create + 3 status changes), got ${orderAudits.length}`);

  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
