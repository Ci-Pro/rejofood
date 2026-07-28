/**
 * Integration test untuk session TTL differentiated per role.
 *
 * Test:
 *  1. Customer login → verify TTL = 7 hari (604800000 ms), idleExpiresAt = null
 *  2. Admin login (with 2FA) → verify TTL = 2 jam (7200000 ms), idleExpiresAt = +15 menit
 *  3. Simulasi idle timeout admin: set lastActivityAt ke 20 menit lalu → verify session ditolak
 *  4. Simulasi absolute expiry: set expiresAt ke masa lalu → verify session ditolak
 *
 * Jalankan: bun run scripts/test-session-ttl.ts
 */
import { PrismaClient, Role } from "@prisma/client";
import { _generateTokenForTesting } from "../src/lib/auth/totp";

const BASE = "http://localhost:3000";
const db = new PrismaClient();

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
  console.log("\n=== Setup: reset admin 2FA ===");
  // Pastikan admin sudah 2FA-enabled
  const adminUser = await db.user.findUnique({ where: { email: "admin@rejofood.id" } });
  if (!adminUser?.twoFactorEnabled) {
    console.log("  Admin belum 2FA-enabled. Run test-2fa.ts first.");
    process.exit(1);
  }
  console.log("  Admin 2FA already enabled ✅");

  console.log("\n=== TEST 1: Customer session — TTL 7 hari, tanpa idle timeout ===");
  const custLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "customer@rejofood.id", password: "rejo1234", expectedRole: "CUSTOMER" }),
  });
  const custLogin = await custLoginRes.json();
  assert(custLoginRes.status === 200, "customer login HTTP 200");
  const custCookie = custLoginRes.headers.get("set-cookie")?.match(/rejo_session=([^;]+)/)?.[0];
  assert(!!custCookie, "customer cookie set");

  const custSessionRes = await fetch(`${BASE}/api/auth/session-info`, {
    headers: { cookie: custCookie! },
  });
  const custSession = await custSessionRes.json();
  assert(custSessionRes.status === 200, "session-info HTTP 200");
  assert(custSession.absoluteTtlMs === 1000 * 60 * 60 * 24 * 7, `customer TTL = 7 hari (got ${custSession.absoluteTtlMs})`);
  assert(custSession.idleTimeoutMs === null, "customer idle timeout = null");
  assert(custSession.idleExpiresAt === null, "customer idleExpiresAt = null");
  assert(!!custSession.expiresAt, "customer expiresAt set");

  const custExpiresAt = new Date(custSession.expiresAt).getTime();
  const custExpectedMs = Date.now() + 1000 * 60 * 60 * 24 * 7;
  const custDelta = Math.abs(custExpiresAt - custExpectedMs);
  assert(custDelta < 5000, `expiresAt ~ +7 hari (delta ${custDelta}ms)`);

  console.log("\n=== TEST 2: Admin session — TTL 2 jam + idle 15 menit ===");
  // Logout customer first
  await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: custCookie! },
  });

  const adminLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@rejofood.id", password: "rejo1234", expectedRole: "ADMIN" }),
  });
  const adminLogin = await adminLoginRes.json();
  assert(adminLogin.needsTwoFactor === true, "admin needs 2FA");

  const code = _generateTokenForTesting(adminUser.twoFactorSecret!);
  const verifyRes = await fetch(`${BASE}/api/auth/2fa/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeToken: adminLogin.challengeToken, code }),
  });
  const verifyData = await verifyRes.json();
  assert(verifyRes.status === 200, "2FA verify success");
  const adminCookie = verifyRes.headers.get("set-cookie")?.match(/rejo_session=([^;]+)/)?.[0];
  assert(!!adminCookie, "admin cookie set");

  const adminSessionRes = await fetch(`${BASE}/api/auth/session-info`, {
    headers: { cookie: adminCookie! },
  });
  const adminSession = await adminSessionRes.json();
  assert(adminSessionRes.status === 200, "admin session-info HTTP 200");
  assert(adminSession.absoluteTtlMs === 1000 * 60 * 60 * 2, `admin TTL = 2 jam (got ${adminSession.absoluteTtlMs})`);
  assert(adminSession.idleTimeoutMs === 1000 * 60 * 15, `admin idle timeout = 15 menit (got ${adminSession.idleTimeoutMs})`);
  assert(!!adminSession.idleExpiresAt, "admin idleExpiresAt set (not null)");

  const adminExpiresAt = new Date(adminSession.expiresAt).getTime();
  const adminIdleAt = new Date(adminSession.idleExpiresAt).getTime();
  const now = Date.now();
  assert(adminExpiresAt - now > 1000 * 60 * 119 && adminExpiresAt - now < 1000 * 60 * 121, `expiresAt ~ +2 jam (got ${Math.round((adminExpiresAt - now) / 1000)}s)`);
  assert(adminIdleAt - now > 1000 * 60 * 14 && adminIdleAt - now < 1000 * 60 * 16, `idleExpiresAt ~ +15 menit (got ${Math.round((adminIdleAt - now) / 1000)}s)`);

  console.log("\n=== TEST 3: Simulasi idle timeout admin (set lastActivityAt 20 menit lalu) ===");
  // Logout admin first, login fresh
  await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: adminCookie! },
  });

  const adminLogin2Res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@rejofood.id", password: "rejo1234", expectedRole: "ADMIN" }),
  });
  const adminLogin2 = await adminLogin2Res.json();
  const code2 = _generateTokenForTesting(adminUser.twoFactorSecret!);
  const verify2Res = await fetch(`${BASE}/api/auth/2fa/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeToken: adminLogin2.challengeToken, code: code2 }),
  });
  const adminCookie2 = verify2Res.headers.get("set-cookie")?.match(/rejo_session=([^;]+)/)?.[0];

  // Manually set lastActivityAt to 20 minutes ago (idle > 15 min)
  await db.session.updateMany({
    where: { token: adminCookie2!.split("=")[1] },
    data: { lastActivityAt: new Date(Date.now() - 20 * 60 * 1000) },
  });

  const expiredRes = await fetch(`${BASE}/api/auth/session-info`, {
    headers: { cookie: adminCookie2! },
  });
  const expiredData = await expiredRes.json();
  assert(expiredData.user === null, `idle-expired session returns no user (got ${JSON.stringify(expiredData.user)})`);

  // Verify session row deleted from DB
  const deletedCount = await db.session.count({ where: { token: adminCookie2!.split("=")[1] } });
  assert(deletedCount === 0, "idle-expired session deleted from DB");

  console.log("\n=== TEST 4: Simulasi absolute expiry (set expiresAt ke masa lalu) ===");
  // Customer login fresh, then manually expire
  const cust2LoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "customer@rejofood.id", password: "rejo1234", expectedRole: "CUSTOMER" }),
  });
  const cust2Cookie = cust2LoginRes.headers.get("set-cookie")?.match(/rejo_session=([^;]+)/)?.[0];

  await db.session.updateMany({
    where: { token: cust2Cookie!.split("=")[1] },
    data: { expiresAt: new Date(Date.now() - 1000) }, // 1 detik lalu
  });

  const expiredCustRes = await fetch(`${BASE}/api/auth/session-info`, {
    headers: { cookie: cust2Cookie! },
  });
  const expiredCustData = await expiredCustRes.json();
  assert(expiredCustData.user === null, "absolute-expired session returns no user");

  console.log("\n=== TEST 5: Touch lastActivityAt saat request berjalan ===");
  // Customer login fresh, lihat lastActivityAt awal, lalu tunggu 1.5 detik, fetch session-info lagi
  const cust3LoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "customer@rejofood.id", password: "rejo1234", expectedRole: "CUSTOMER" }),
  });
  const cust3Cookie = cust3LoginRes.headers.get("set-cookie")?.match(/rejo_session=([^;]+)/)?.[0];
  const cust3Token = cust3Cookie!.split("=")[1];

  const sessionBefore = await db.session.findUnique({ where: { token: cust3Token } });
  assert(!!sessionBefore?.lastActivityAt, "lastActivityAt set on creation");

  await new Promise((r) => setTimeout(r, 1500));

  // Touch via session-info (yang memanggil getCurrentUser internally)
  await fetch(`${BASE}/api/auth/session-info`, {
    headers: { cookie: cust3Cookie! },
  });

  const sessionAfter = await db.session.findUnique({ where: { token: cust3Token } });
  assert(
    sessionAfter!.lastActivityAt!.getTime() >= sessionBefore!.lastActivityAt!.getTime(),
    "lastActivityAt touched (≥ before)"
  );

  console.log("\n=== TEST 6: Touch throttling (tidak update jika < 1 menit) ===");
  // Fetch 2x cepat, verify lastActivityAt tidak berubah
  const t0 = sessionAfter!.lastActivityAt!.getTime();
  await fetch(`${BASE}/api/auth/session-info`, {
    headers: { cookie: cust3Cookie! },
  });
  const sessionAfter2 = await db.session.findUnique({ where: { token: cust3Token } });
  assert(
    sessionAfter2!.lastActivityAt!.getTime() === t0,
    `lastActivityAt tidak berubah jika < 1 menit (delta: ${sessionAfter2!.lastActivityAt!.getTime() - t0}ms)`
  );

  await db.$disconnect();
  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
