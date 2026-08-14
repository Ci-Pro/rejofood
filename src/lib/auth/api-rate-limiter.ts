/**
 * Generic rate limiter untuk API endpoints (order, payment, wallet, dll).
 *
 * Berbeda dengan rate-limiter.ts (yang spesifik login dengan lockout),
 * rate limiter ini lebih simple: hitung request per window, reject kalau exceed.
 *
 * Strategi: sliding window counter per IP+endpoint.
 * Cocok untuk:
 *  - POST /api/orders (max 10 per menit per IP — anti spam order)
 *  - POST /api/payment/create (max 10 per menit)
 *  - POST /api/wallet/topup (max 5 per menit — anti fraud)
 *  - POST /api/wallet/withdraw (max 5 per menit)
 *
 * In-memory: cocok untuk single-instance. Untuk multi-instance, swap ke Redis.
 */

interface RateBucket {
  count: number;
  windowStart: number;
}

const store: Map<string, RateBucket> = (globalThis as unknown as {
  __rejoApiRateLimitStore?: Map<string, RateBucket>;
}).__rejoApiRateLimitStore ?? new Map<string, RateBucket>();
(globalThis as unknown as { __rejoApiRateLimitStore?: Map<string, RateBucket> }).__rejoApiRateLimitStore = store;

// Sweeper: cleanup old buckets setiap 10 menit
let sweeperStarted = false;
function ensureSweeper() {
  if (sweeperStarted) return;
  sweeperStarted = true;
  setInterval(() => {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 jam
    for (const [key, b] of store) {
      if (now - b.windowStart > maxAge) store.delete(key);
    }
  }, 10 * 60 * 1000).unref?.();
}

export interface ApiRateLimitResult {
  allowed: boolean;
  /** Sisa request yang bisa dilakukan dalam window ini */
  remaining: number;
  /** Reset timestamp (epoch ms) — kapan counter reset */
  resetAt: number;
  /** Detik sampai reset, untuk header Retry-After */
  retryAfterSeconds: number;
}

/**
 * Check rate limit untuk endpoint.
 *
 * @param identifier — biasanya IP address (atau IP + userId untuk authenticated endpoint)
 * @param endpoint — nama endpoint untuk grouping (mis. "orders:create", "wallet:topup")
 * @param maxRequests — max request per window
 * @param windowMs — window duration dalam ms
 *
 * @returns { allowed, remaining, resetAt, retryAfterSeconds }
 *
 * Usage:
 * ```ts
 * const rl = checkApiRateLimit(ip, "orders:create", 10, 60_000);
 * if (!rl.allowed) {
 *   return NextResponse.json(
 *     { error: "Terlalu banyak request. Coba lagi dalam " + rl.retryAfterSeconds + " detik." },
 *     { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
 *   );
 * }
 * ```
 */
export function checkApiRateLimit(
  identifier: string,
  endpoint: string,
  maxRequests: number,
  windowMs: number = 60_000, // default 1 menit
): ApiRateLimitResult {
  ensureSweeper();

  const key = `${identifier}::${endpoint}`;
  const now = Date.now();
  const bucket = store.get(key);

  // Reset bucket kalau window sudah lewat
  if (!bucket || now - bucket.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  // Increment counter
  bucket.count++;
  const remaining = Math.max(0, maxRequests - bucket.count);
  const resetAt = bucket.windowStart + windowMs;
  const retryAfterSeconds = Math.ceil((resetAt - now) / 1000);

  if (bucket.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    remaining,
    resetAt,
    retryAfterSeconds,
  };
}

/**
 * Get client IP dari Next.js Request.
 * Handle Vercel proxy (x-forwarded-for) + Capacitor (x-real-ip).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();
  return "unknown";
}

/**
 * Helper: rate limit + auto-respond 429 kalau exceeded.
 *
 * Usage:
 * ```ts
 * const limited = rateLimitResponse(req, "orders:create", 10, 60_000);
 * if (limited) return limited;
 * ```
 */
export function rateLimitResponse(
  req: Request,
  endpoint: string,
  maxRequests: number,
  windowMs: number = 60_000,
): Response | null {
  const ip = getClientIp(req);
  const rl = checkApiRateLimit(ip, endpoint, maxRequests, windowMs);
  if (!rl.allowed) {
    return Response.json(
      {
        error: `Terlalu banyak request. Coba lagi dalam ${rl.retryAfterSeconds} detik.`,
        code: "RATE_LIMITED",
        retryAfterSeconds: rl.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfterSeconds),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rl.resetAt),
        },
      },
    );
  }
  return null;
}
