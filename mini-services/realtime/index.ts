/**
 * RejoFood Realtime Service — Socket.IO server.
 *
 * Port: 3001 (via gateway XTransformPort=3001)
 *
 * FLOW:
 *  1. Client connect: io("/?XTransformPort=3001") dengan cookie session
 *  2. Server verify cookie via internal /api/auth/session (calls Next.js)
 *  3. Server join client ke rooms sesuai role:
 *       - role:admin, role:merchant, role:driver, role:customer
 *       - merchant:{userId} (untuk merchant sendiri)
 *       - customer:{userId}, driver:{userId}
 *  4. Next.js API routes emit events via POST http://localhost:3001/emit (internal, shared secret)
 *  5. Server broadcast ke room yang sesuai
 *
 * Events:
 *  - order:created      → to merchant + admin
 *  - order:status       → to customer + (merchant if driver action) + admin
 *  - order:driver_assigned → to customer + merchant + admin
 */

import { createServer, IncomingMessage } from "http";
import { Server, Socket } from "socket.io";
import crypto from "node:crypto";

const PORT = 3001;
const INTERNAL_SECRET = process.env.REJO_REALTIME_SECRET || "dev-secret-change-in-prod";
const NEXTJS_BASE = process.env.REJO_NEXTJS_BASE || "http://localhost:3000";

interface AuthUser {
  id: string;
  email: string;
  role: "CUSTOMER" | "MERCHANT" | "DRIVER" | "ADMIN";
  fullName: string;
}

interface EmitPayload {
  event: string;
  /** Room target: "role:admin", "merchant:{userId}", "customer:{userId}", "driver:{userId}" */
  rooms?: string[];
  /** Broadcast ke semua kalau true (ignore rooms) */
  broadcast?: boolean;
  data: unknown;
}

/** Extract rejo_session cookie dari Cookie header. */
function extractSessionCookie(req: IncomingMessage): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/rejo_session=([^;]+)/);
  return match ? match[1] : null;
}

/** Verify session via Next.js internal API. */
async function verifySession(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${NEXTJS_BASE}/api/auth/session`, {
      headers: { cookie: `rejo_session=${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { user: AuthUser | null };
    return data.user ?? null;
  } catch (err) {
    console.error("[realtime] verifySession error:", err);
    return null;
  }
}

/** Verify internal emit secret. */
function verifyInternalSecret(req: IncomingMessage): boolean {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  // Constant-time compare
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(INTERNAL_SECRET);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Determine which rooms this user should join. */
function roomsForUser(user: AuthUser): string[] {
  const rooms = [`role:${user.role.toLowerCase()}`, `user:${user.id}`];
  return rooms;
}

const httpServer = createServer(async (req, res) => {
  // CORS headers for emit endpoint (internal)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, port: PORT, connections: io.engine.clientsCount }));
    return;
  }

  // Internal emit endpoint
  if (req.url === "/emit" && req.method === "POST") {
    if (!verifyInternalSecret(req)) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const payload = JSON.parse(body) as EmitPayload;
      if (payload.broadcast) {
        io.emit(payload.event, payload.data);
      } else if (payload.rooms && payload.rooms.length > 0) {
        for (const room of payload.rooms) {
          io.to(room).emit(payload.event, payload.data);
        }
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, sent: payload.broadcast ? "broadcast" : payload.rooms }));
    } catch (err) {
      console.error("[realtime] emit parse error:", err);
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Invalid JSON" }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

const io = new Server(httpServer, {
  // Path default socket.io — biarkan `/socket.io/`, jangan `/`
  // karena `/` collide dengan HTTP routes kita (/health, /emit)
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Auth middleware: verify session on connect
io.use(async (socket: Socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie;
  if (!cookieHeader) {
    return next(new Error("No cookie"));
  }
  const match = cookieHeader.match(/rejo_session=([^;]+)/);
  if (!match) {
    return next(new Error("No session cookie"));
  }
  const user = await verifySession(match[1]);
  if (!user) {
    return next(new Error("Invalid session"));
  }
  // Attach user to socket
  (socket as Socket & { user?: AuthUser }).user = user;
  next();
});

io.on("connection", (socket: Socket) => {
  const user = (socket as Socket & { user?: AuthUser }).user;
  if (!user) {
    socket.disconnect();
    return;
  }

  console.log(`[realtime] connected: ${user.email} (${user.role})`);

  // Join role + user-specific rooms
  for (const room of roomsForUser(user)) {
    socket.join(room);
  }

  // Acknowledge connection with user info
  socket.emit("connected", { user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName } });

  socket.on("disconnect", (reason) => {
    console.log(`[realtime] disconnected: ${user.email} (${reason})`);
  });

  socket.on("error", (err) => {
    console.error(`[realtime] socket error (${user.email}):`, err);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[realtime] RejoFood realtime service running on port ${PORT}`);
  console.log(`[realtime] Next.js base: ${NEXTJS_BASE}`);
  console.log(`[realtime] Internal emit endpoint: POST /emit (auth: Bearer ${INTERNAL_SECRET.substring(0, 8)}...)`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[realtime] SIGTERM received, closing...");
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
});

process.on("SIGINT", () => {
  console.log("[realtime] SIGINT received, closing...");
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
});
