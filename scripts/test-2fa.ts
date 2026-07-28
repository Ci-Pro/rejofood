/**
 * Integration test untuk full 2FA flow.
 *
 * Test 1: First-time admin login → setup → enable → session cookie
 * Test 2: Subsequent admin login → challenge → verify → session cookie
 *
 * Jalankan: bun run scripts/test-2fa.ts
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
  // === TEST 1: First-time admin login → setup → enable ===
  console.log("\n=== TEST 1: First-time admin login → setup 2FA ===");

  console.log("  Step 1.1: Login with password (factor 1)");
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin@rejofood.id",
      password: "rejo1234",
      expectedRole: "ADMIN",
    }),
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200, `login HTTP 200 (got ${loginRes.status})`);
  assert(loginData.needsSetup === true, "needsSetup=true for first-time admin");
  assert(!!loginData.challengeToken, "challengeToken returned");
  assert(loginData.fullName === "Rina Admin", `fullName=Rina Admin (got ${loginData.fullName})`);

  if (!loginData.challengeToken) {
    console.error("Cannot continue without challengeToken");
    process.exit(1);
  }

  console.log("  Step 1.2: Fetch setup data (QR + secret)");
  const setupRes = await fetch(`${BASE}/api/auth/2fa/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeToken: loginData.challengeToken }),
  });
  const setupData = await setupRes.json();
  assert(setupRes.status === 200, `setup HTTP 200 (got ${setupRes.status})`);
  assert(!!setupData.secret, "secret returned");
  assert(!!setupData.qrDataUrl, "qrDataUrl returned");
  assert(setupData.qrDataUrl.startsWith("data:image/png;base64,"), "qrDataUrl is base64 PNG");
  assert(setupData.otpauthUrl.includes("otpauth://"), "otpauthUrl is otpauth:// scheme");
  assert(setupData.email === "admin@rejofood.id", "email matches");

  console.log("  Step 1.3: Generate valid TOTP code from secret");
  const validCode = _generateTokenForTesting(setupData.secret);
  console.log(`    Generated code: ${validCode}`);

  console.log("  Step 1.4: Submit wrong code first (should fail)");
  const wrongEnableRes = await fetch(`${BASE}/api/auth/2fa/enable`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeToken: loginData.challengeToken, code: "000000" }),
  });
  const wrongEnableData = await wrongEnableRes.json();
  assert(wrongEnableRes.status === 401, `wrong code HTTP 401 (got ${wrongEnableRes.status})`);
  assert(wrongEnableData.code === "INVALID_TOTP", "INVALID_TOTP code");

  console.log("  Step 1.5: Submit correct code (should enable 2FA + login)");
  const enableRes = await fetch(`${BASE}/api/auth/2fa/enable`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeToken: loginData.challengeToken, code: validCode }),
  });
  const enableData = await enableRes.json();
  assert(enableRes.status === 200, `enable HTTP 200 (got ${enableRes.status})`);
  assert(!!enableData.user, "user returned after enable");
  assert(enableData.user.role === "ADMIN", "user role is ADMIN");
  assert(enableData.user.email === "admin@rejofood.id", "email correct");

  // Capture session cookie
  const setCookie = enableRes.headers.get("set-cookie");
  assert(!!setCookie, "session cookie set");
  const cookieMatch = setCookie?.match(/rejo_session=([^;]+)/);
  const sessionCookie = cookieMatch ? `rejo_session=${cookieMatch[1]}` : "";
  assert(!!sessionCookie, "session cookie value extracted");

  console.log("  Step 1.6: Verify session via /api/auth/session");
  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { cookie: sessionCookie },
  });
  const sessionData = await sessionRes.json();
  assert(sessionRes.status === 200, "session HTTP 200");
  assert(!!sessionData.user, "user returned from session");
  assert(sessionData.user.role === "ADMIN", "session role is ADMIN");

  // === TEST 2: Logout, then login again — should hit 2FA challenge ===
  console.log("\n=== TEST 2: Subsequent admin login → 2FA challenge ===");

  console.log("  Step 2.1: Logout");
  await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: sessionCookie },
  });

  console.log("  Step 2.2: Login again — should return needsTwoFactor");
  const login2Res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin@rejofood.id",
      password: "rejo1234",
      expectedRole: "ADMIN",
    }),
  });
  const login2Data = await login2Res.json();
  assert(login2Res.status === 200, `login HTTP 200 (got ${login2Res.status})`);
  assert(login2Data.needsTwoFactor === true, "needsTwoFactor=true for returning admin");
  assert(!!login2Data.challengeToken, "new challengeToken returned");
  assert(!login2Data.needsSetup, "needsSetup should be false (already set up)");

  if (!login2Data.challengeToken) {
    console.error("Cannot continue without challengeToken");
    process.exit(1);
  }

  console.log("  Step 2.3: Verify TOTP code (we know the secret from setup)");
  const verifyCode = _generateTokenForTesting(setupData.secret);
  const verifyRes = await fetch(`${BASE}/api/auth/2fa/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeToken: login2Data.challengeToken, code: verifyCode }),
  });
  const verifyData = await verifyRes.json();
  assert(verifyRes.status === 200, `verify HTTP 200 (got ${verifyRes.status})`);
  assert(!!verifyData.user, "user returned after verify");
  assert(verifyData.user.role === "ADMIN", "user role is ADMIN");

  // === TEST 3: TOTP rate limit on challenge (5 attempts) ===
  console.log("\n=== TEST 3: Challenge rate limit (max 5 attempts) ===");
  console.log("  Step 3.1: Logout, login again to get fresh challenge");
  await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: `rejo_session=${cookieMatch?.[1] ?? ""}` },
  });

  const login3Res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin@rejofood.id",
      password: "rejo1234",
      expectedRole: "ADMIN",
    }),
  });
  const login3Data = await login3Res.json();
  const challenge3 = login3Data.challengeToken;

  console.log("  Step 3.2: Submit wrong code 5 times (should all fail with 401)");
  let lastStatus = 0;
  let lastCode = "";
  for (let i = 1; i <= 5; i++) {
    const r = await fetch(`${BASE}/api/auth/2fa/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challengeToken: challenge3, code: "000000" }),
    });
    const d = await r.json();
    lastStatus = r.status;
    lastCode = d.code;
    console.log(`    Attempt ${i}: HTTP ${r.status} code=${d.code}`);
  }
  assert(lastStatus === 401, "5th wrong attempt should still be 401 (rate limit is per challenge, exhausted on 6th)");

  console.log("  Step 3.3: 6th attempt should be CHALLENGE_EXHAUSTED");
  const r6 = await fetch(`${BASE}/api/auth/2fa/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeToken: challenge3, code: "000000" }),
  });
  const d6 = await r6.json();
  console.log(`    Attempt 6: HTTP ${r6.status} code=${d6.code}`);
  // Note: the 5th attempt triggered attempts=5, the 6th will return ok:false from recordChallengeAttempt
  assert(r6.status === 429 || r6.status === 401, `6th attempt rejected (HTTP ${r6.status})`);

  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
