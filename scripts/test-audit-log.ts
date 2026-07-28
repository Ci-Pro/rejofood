/**
 * Integration test untuk AuditLog.
 * Login admin full flow → cek audit log terisi dengan events yang benar.
 *
 * Jalankan: bun run scripts/test-audit-log.ts
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

async function main() {
  // Step 1: Clear audit log
  console.log("\n=== Setup: clear audit log via DB ===");
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  await db.auditLog.deleteMany({});
  console.log("  AuditLog cleared");

  // Step 2: Trigger various events
  console.log("\n=== Triggering events ===");

  console.log("  - Failed login (wrong password)");
  await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "customer@rejofood.id", password: "wrong", expectedRole: "CUSTOMER" }),
  });

  console.log("  - Role mismatch login (customer trying merchant)");
  await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "customer@rejofood.id", password: "rejo1234", expectedRole: "MERCHANT" }),
  });

  console.log("  - Successful customer login");
  const custRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "customer@rejofood.id", password: "rejo1234", expectedRole: "CUSTOMER" }),
  });
  const custCookie = custRes.headers.get("set-cookie")?.match(/rejo_session=([^;]+)/)?.[0];
  assert(!!custCookie, "customer session cookie set");

  console.log("  - Customer logout");
  await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: custCookie! },
  });

  console.log("  - Admin self-register attempt (denied)");
  await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "hacker@test.id", password: "123456", fullName: "Hacker X", role: "ADMIN" }),
  });

  // Step 3: Admin full login flow
  console.log("\n=== Admin login (with 2FA already enabled) ===");
  const adminUser = await db.user.findUnique({ where: { email: "admin@rejofood.id" } });
  if (!adminUser?.twoFactorEnabled) {
    console.error("  Admin not 2FA enabled — run test-2fa.ts first");
    process.exit(1);
  }

  const adminLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@rejofood.id", password: "rejo1234", expectedRole: "ADMIN" }),
  });
  const adminLogin = await adminLoginRes.json();
  assert(adminLogin.needsTwoFactor === true, "admin needs 2FA challenge");

  // Verify TOTP
  const code = _generateTokenForTesting(adminUser.twoFactorSecret!);
  const verifyRes = await fetch(`${BASE}/api/auth/2fa/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeToken: adminLogin.challengeToken, code }),
  });
  const verifyData = await verifyRes.json();
  assert(verifyRes.status === 200, `2FA verify success (got ${verifyRes.status})`);
  const adminCookie = verifyRes.headers.get("set-cookie")?.match(/rejo_session=([^;]+)/)?.[0];
  assert(!!adminCookie, "admin session cookie set");

  // Step 4: List audit logs as admin
  console.log("\n=== List audit logs (as admin) ===");
  const listRes = await fetch(`${BASE}/api/audit/logs?limit=50`, {
    headers: { cookie: adminCookie! },
  });
  const listData = await listRes.json();
  assert(listRes.status === 200, `audit logs HTTP 200 (got ${listRes.status})`);
  assert(typeof listData.total === "number", `total is number (got ${typeof listData.total})`);
  assert(Array.isArray(listData.items), "items is array");

  console.log(`\n  Total events: ${listData.total}`);
  console.log("  Events captured:");
  for (const log of listData.items) {
    console.log(`    ${log.action.padEnd(40)} | ${log.outcome.padEnd(7)} | ${log.actorEmail ?? "-"} | ${log.description.substring(0, 60)}`);
  }

  // Verify specific events are present
  const actions = listData.items.map((l: { action: string }) => l.action);
  assert(actions.includes("auth.login.failed"), "login.failed event captured");
  assert(actions.includes("auth.login.role_mismatch"), "login.role_mismatch event captured");
  assert(actions.includes("auth.login.success"), "login.success event captured");
  assert(actions.includes("auth.logout"), "logout event captured");
  assert(actions.includes("auth.register.denied"), "register.denied event captured");
  assert(actions.includes("auth.2fa.challenge_sent"), "2fa.challenge_sent event captured");
  assert(actions.includes("auth.2fa.verify_success"), "2fa.verify_success event captured");

  // Step 5: Test filter
  console.log("\n=== Test filter: category=auth + outcome=denied ===");
  const filterRes = await fetch(`${BASE}/api/audit/logs?category=auth&outcome=denied`, {
    headers: { cookie: adminCookie! },
  });
  const filterData = await filterRes.json();
  const allDeniedAuth = filterData.items.every((i: { category: string; outcome: string }) => i.category === "auth" && i.outcome === "denied");
  assert(allDeniedAuth, `filter works (${filterData.items.length} items, all auth+denied)`);
  assert(filterData.items.length > 0, "filter returns at least 1 item");

  // Step 6: Test forbidden (no cookie)
  console.log("\n=== Test forbidden: GET without admin cookie ===");
  const forbidRes = await fetch(`${BASE}/api/audit/logs`);
  assert(forbidRes.status === 403, `forbidden HTTP 403 (got ${forbidRes.status})`);

  // Step 7: Categories endpoint
  console.log("\n=== Test /api/audit/categories ===");
  const catRes = await fetch(`${BASE}/api/audit/categories`, {
    headers: { cookie: adminCookie! },
  });
  const catData = await catRes.json();
  assert(catRes.status === 200, `categories HTTP 200`);
  assert(Array.isArray(catData.categories) && catData.categories.includes("auth"), `categories contains "auth"`);

  await db.$disconnect();
  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
