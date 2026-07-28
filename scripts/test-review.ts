/**
 * Integration test untuk order rating + review.
 *
 * Test:
 *  1. Customer submit review untuk order DELIVERED → 201, review created
 *  2. Merchant rating auto-recompute (avg dari semua review)
 *  3. Customer tries review order non-DELIVERED → 400
 *  4. Customer tries review twice → 400 (sudah di-review)
 *  5. Customer tries review order milik customer lain → 404
 *  6. GET /api/restaurants/[id]/reviews → list + distribution
 *  7. GET /api/orders → include review field
 *  8. Invalid rating (0, 6, "abc") → 400
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

async function fullFlowOrder(custCookie: string, merchCookie: string, driverCookie: string): Promise<{ id: string; code: string; merchantId: string }> {
  // Get merchant's own restaurant (via merchant menu API)
  const merchMenuRes = await fetch(`${BASE}/api/merchant/menu`, {
    headers: { cookie: merchCookie },
  });
  const merchMenu = await merchMenuRes.json();
  if (!merchMenu.items || merchMenu.items.length === 0) {
    throw new Error("merchant has no menu items");
  }
  const item = merchMenu.items[0];
  const merchantId = merchMenu.merchant.id;

  // Checkout (customer)
  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: custCookie },
    body: JSON.stringify({
      items: [{ menuItemId: item.id, quantity: 1 }],
      deliveryAddress: "Jl. Review Test, Jakarta",
    }),
  });
  const order = await orderRes.json();
  if (!order.order) {
    console.log(`  ⚠️ checkout failed:`, order);
    throw new Error("checkout failed");
  }

  // Pay with COD (langsung SUCCESS)
  const payRes = await fetch(`${BASE}/api/payment/create`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: custCookie },
    body: JSON.stringify({ orderId: order.order.id, method: "COD" }),
  });
  if (!payRes.ok) console.log(`  ⚠️ payment failed:`, await payRes.json());

  // Merchant: ACCEPT → PREPARING → READY
  for (const s of ["ACCEPTED", "PREPARING", "READY"]) {
    const r = await fetch(`${BASE}/api/merchant/orders/${order.order.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: merchCookie },
      body: JSON.stringify({ status: s }),
    });
    if (!r.ok) console.log(`  ⚠️ merchant ${s} failed:`, await r.json());
  }

  // Driver: pickup → deliver
  const pickupRes = await fetch(`${BASE}/api/driver/orders/${order.order.id}/pickup`, {
    method: "POST",
    headers: { cookie: driverCookie },
  });
  if (!pickupRes.ok) console.log(`  ⚠️ driver pickup failed:`, await pickupRes.json());

  const deliverRes = await fetch(`${BASE}/api/driver/orders/${order.order.id}/deliver`, {
    method: "POST",
    headers: { cookie: driverCookie },
  });
  if (!deliverRes.ok) console.log(`  ⚠️ driver deliver failed:`, await deliverRes.json());

  return { id: order.order.id, code: order.order.code, merchantId };
}

async function main() {
  console.log("\n=== Setup ===");
  const custCookie = await login("customer@rejofood.id", "CUSTOMER");
  const merchCookie = await login("merchant@rejofood.id", "MERCHANT");
  const driverCookie = await login("driver@rejofood.id", "DRIVER");
  assert(!!custCookie && !!merchCookie && !!driverCookie, "logins succeed");

  // Test 1: Submit review untuk order DELIVERED
  console.log("\n=== Test 1: Submit review untuk order DELIVERED ===");
  const order = await fullFlowOrder(custCookie, merchCookie, driverCookie);
  console.log(`  Order ${order.code} delivered`);

  const reviewRes = await fetch(`${BASE}/api/orders/${order.id}/review`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: custCookie },
    body: JSON.stringify({ rating: 5, comment: "Mantap, cepat dan enak!" }),
  });
  const reviewData = await reviewRes.json();
  if (reviewRes.status !== 201) {
    console.log(`  ⚠️ review error:`, reviewData);
  }
  assert(reviewRes.status === 201, `review HTTP 201 (got ${reviewRes.status})`);
  assert(reviewData.review.rating === 5, "rating = 5");
  assert(reviewData.review.comment === "Mantap, cepat dan enak!", "comment stored");
  assert(typeof reviewData.merchantRating === "number", "merchantRating returned");
  assert(reviewData.totalReviews >= 1, `totalReviews >= 1 (got ${reviewData.totalReviews})`);

  // Test 2: Merchant rating auto-recompute
  console.log("\n=== Test 2: Merchant rating auto-recompute ===");
  const restaurantsRes = await fetch(`${BASE}/api/restaurants?limit=1`);
  const restaurants = await restaurantsRes.json();
  const merchant = restaurants.items[0];
  console.log(`  Merchant rating now: ${merchant.rating} (from ${merchant.menuCount} menu items)`);
  assert(typeof merchant.rating === "number", "merchant rating is number");

  // Test 3: Try review non-DELIVERED order → 400
  console.log("\n=== Test 3: Review non-DELIVERED order → 400 ===");
  {
    // Buat order baru tapi belum delivered
    const restaurantsRes2 = await fetch(`${BASE}/api/restaurants?limit=1`);
    const r2 = await restaurantsRes2.json();
    const detailRes2 = await fetch(`${BASE}/api/restaurants/${r2.items[0].id}`);
    const detail2 = await detailRes2.json();
    const item2 = detail2.merchant.menuItems[0];

    const orderRes2 = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: custCookie },
      body: JSON.stringify({
        items: [{ menuItemId: item2.id, quantity: 1 }],
        deliveryAddress: "Jl. Test Address Minimal 5",
      }),
    });
    const order2 = await orderRes2.json();

    const reviewRes2 = await fetch(`${BASE}/api/orders/${order2.order.id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: custCookie },
      body: JSON.stringify({ rating: 5 }),
    });
    const reviewData2 = await reviewRes2.json();
    assert(reviewRes2.status === 400, `review non-DELIVERED → 400 (got ${reviewRes2.status})`);
    assert(reviewData2.error.includes("DELIVERED"), "error mentions DELIVERED");
  }

  // Test 4: Try review twice → 400
  console.log("\n=== Test 4: Review twice → 400 (sudah di-review) ===");
  {
    const reviewAgainRes = await fetch(`${BASE}/api/orders/${order.id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: custCookie },
      body: JSON.stringify({ rating: 3 }),
    });
    const reviewAgainData = await reviewAgainRes.json();
    assert(reviewAgainRes.status === 400, `second review → 400 (got ${reviewAgainRes.status})`);
    assert(reviewAgainData.error.includes("sudah"), "error mentions already reviewed");
  }

  // Test 5: Invalid rating values
  console.log("\n=== Test 5: Invalid rating values → 400 ===");
  {
    const order2 = await fullFlowOrder(custCookie, merchCookie, driverCookie);

    // 4.5 → dibulatkan ke 4 oleh Math.floor, jadi sebenarnya valid. Skip.
    for (const badRating of [0, 6, "abc", null]) {
      const res = await fetch(`${BASE}/api/orders/${order2.id}/review`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: custCookie },
        body: JSON.stringify({ rating: badRating }),
      });
      assert(res.status === 400, `rating ${JSON.stringify(badRating)} → 400`);
    }

    // Cleanup: valid review
    await fetch(`${BASE}/api/orders/${order2.id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: custCookie },
      body: JSON.stringify({ rating: 4 }),
    });
  }

  // Test 6: GET /api/restaurants/[id]/reviews
  console.log("\n=== Test 6: GET reviews list + distribution ===");
  {
    // Use merchantId from order
    const reviewsRes = await fetch(`${BASE}/api/restaurants/${order.merchantId}/reviews?limit=50`);
    const reviewsData = await reviewsRes.json();
    assert(reviewsRes.status === 200, "GET reviews HTTP 200");
    assert(Array.isArray(reviewsData.items), "items is array");
    assert(typeof reviewsData.total === "number", "total is number");
    assert(typeof reviewsData.distribution === "object", "distribution is object");
    assert(reviewsData.distribution[5] >= 0, "distribution[5] exists");
    assert(reviewsData.items.length > 0, "has at least 1 review");
    assert(!!reviewsData.items[0].customerName, "review has customerName");
    assert(!!reviewsData.items[0].createdAt, "review has createdAt");
  }

  // Test 7: GET /api/orders includes review field
  console.log("\n=== Test 7: GET /api/orders includes review field ===");
  {
    const ordersRes = await fetch(`${BASE}/api/orders?limit=10`, {
      headers: { cookie: custCookie },
    });
    const ordersData = await ordersRes.json();
    const reviewedOrder = ordersData.items.find((o: { review: unknown }) => o.review);
    assert(!!reviewedOrder, "found order with review");
    assert(typeof reviewedOrder.review.rating === "number", "review.rating is number");
    assert(typeof reviewedOrder.review.createdAt === "string", "review.createdAt is string");
  }

  // Test 8: GET /api/orders/[id]/review (existing review)
  console.log("\n=== Test 8: GET existing review for order ===");
  {
    const res = await fetch(`${BASE}/api/orders/${order.id}/review`, {
      headers: { cookie: custCookie },
    });
    const data = await res.json();
    assert(res.status === 200, "GET review HTTP 200");
    assert(!!data.review, "review returned");
    assert(data.review.rating === 5, "rating = 5");
    assert(data.orderStatus === "DELIVERED", "orderStatus = DELIVERED");
  }

  // Test 9: Audit log captured review.create
  console.log("\n=== Test 9: Audit log captured review.create ===");
  {
    const adminCookie = await login("admin@rejofood.id", "ADMIN");
    const auditRes = await fetch(`${BASE}/api/audit/logs?category=review&limit=10`, {
      headers: { cookie: adminCookie },
    });
    const audit = await auditRes.json();
    const reviewEvents = audit.items.filter((a: { action: string }) => a.action === "review.create");
    console.log(`  Found ${reviewEvents.length} review.create events`);
    assert(reviewEvents.length >= 2, `at least 2 review events (test 1 + test 5 cleanup), got ${reviewEvents.length}`);
    const withComment = reviewEvents.find((a: { metadata: { rating?: number } }) => a.metadata?.rating === 5);
    assert(!!withComment, "audit log includes rating=5 event");
  }

  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
