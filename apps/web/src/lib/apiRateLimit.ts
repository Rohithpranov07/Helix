import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@helix/db";

// ── MongoDB-backed rate limiter HOF ────────────────────────────────────────────
// Wraps route handlers with persistent, atomic rate limiting stored in MongoDB.
// Use this on top of the middleware (in-memory) guard for mutation/expensive routes.

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

// Sensible defaults per route category
export const LIMITS = {
  READ_LIGHT:  { limit: 120, windowMs: 60_000 },  // simple reads
  READ_HEAVY:  { limit: 30,  windowMs: 60_000 },  // multi-query reads (vitals)
  MUTATION:    { limit: 20,  windowMs: 60_000 },  // writes
  SCAN:        { limit: 5,   windowMs: 60_000 },  // full scans
  AI:          { limit: 10,  windowMs: 60_000 },  // AI/LLM calls
  SSE:         { limit: 5,   windowMs: 60_000 },  // SSE streams
} as const;

type RouteCtx = { params: Promise<Record<string, string>> };
type Handler = (req: NextRequest, ctx: RouteCtx) => Promise<NextResponse | Response>;

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Wraps a Next.js App Router handler with MongoDB-backed rate limiting.
 *
 * Rate limit state persists across server restarts and is shared across
 * any future instances (unlike the in-memory middleware guard).
 *
 * Usage:
 *   export const GET = withRateLimit(LIMITS.READ_HEAVY, async (req) => { ... });
 *   export const POST = withRateLimit(LIMITS.SCAN, async (req) => { ... });
 */
export function withRateLimit(opts: RateLimitOptions, handler: Handler): Handler {
  return async (req: NextRequest, ctx: RouteCtx) => {
    const ip = getIp(req);
    const pathname = new URL(req.url).pathname;
    const key = `ip:${ip}:${pathname}`;

    try {
      const result = await checkRateLimit(key, opts.limit, opts.windowMs);

      const rlHeaders: Record<string, string> = {
        "X-RateLimit-Limit":     String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset":     String(Math.ceil(result.resetAt.getTime() / 1000)),
      };

      if (!result.allowed) {
        const retryMs = Math.max(0, result.resetAt.getTime() - Date.now());
        return NextResponse.json(
          {
            error: "RATE_LIMITED",
            message: `Too many requests. Retry in ${Math.ceil(retryMs / 1000)}s.`,
            retryAfterMs: retryMs,
          },
          {
            status: 429,
            headers: { ...rlHeaders, "Retry-After": String(Math.ceil(retryMs / 1000)) },
          },
        );
      }

      const response = await handler(req, ctx);
      const res = response instanceof NextResponse ? response : new NextResponse(response.body, response);
      for (const [k, v] of Object.entries(rlHeaders)) res.headers.set(k, v);
      return res;

    } catch {
      // Rate limiter failure → fail open so the app stays available
      return handler(req, ctx);
    }
  };
}
