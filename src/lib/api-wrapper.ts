/**
 * API route wrapper — automatic try-catch + error logging.
 *
 * Usage:
 * ```ts
 * import { apiHandler } from "@/lib/api-wrapper";
 *
 * export const GET = apiHandler(async (req) => {
 *   const data = await db.user.findMany();
 *   return NextResponse.json(data);
 * });
 *
 * // With params:
 * export const GET = apiHandler(async (req, { params }) => {
 *   const { id } = await params;
 *   ...
 * });
 * ```
 *
 * This wrapper:
 *  - Catches all unhandled errors (DB failures, network issues, etc.)
 *  - Logs error to console with route info
 *  - Returns standardized 500 JSON response
 *  - Preserves any NextResponse returned by handler
 */
import { NextResponse } from "next/server";

type RouteHandler = (req: Request, ctx?: unknown) => Promise<Response | NextResponse>;

export function apiHandler(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      // Extract route path for logging
      const url = new URL(req.url);
      const route = url.pathname;

      console.error(`[API ERROR] ${req.method} ${route}:`, err);

      // Don't leak internal error details in production
      const message = err instanceof Error ? err.message : "Terjadi kesalahan server.";

      return NextResponse.json(
        {
          error: process.env.NODE_ENV === "production"
            ? "Terjadi kesalahan server. Coba lagi."
            : message,
          code: "INTERNAL_ERROR",
        },
        { status: 500 },
      );
    }
  };
}
