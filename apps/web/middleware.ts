import { NextRequest, NextResponse } from "next/server";

// ── In-memory sliding-window rate limiter ──────────────────────────────────────
// Runs on every request before the route handler.
// Edge-compatible (no Node.js APIs). First line of defence — keeps the DB safe
// from bursts. The MongoDB-backed limiter in apiRateLimit.ts adds persistence
// for mutation routes on top of this.

interface Bucket {
  count: number;
  resetAt: number;  // epoch ms
}

// Map key: "{ip}:{pathname}" → Bucket
const buckets = new Map<string, Bucket>();

// Per-route limits (requests / window)
const LIMITS: Array<{ pattern: RegExp; limit: number; windowMs: number }> = [
  { pattern: /^\/api\/stream$/,            limit: 5,   windowMs: 60_000  }, // SSE — tight
  { pattern: /^\/api\/vitals$/,            limit: 60,  windowMs: 60_000  }, // polled every 30 s
  { pattern: /^\/api\/voice\//,            limit: 10,  windowMs: 60_000  }, // AI calls — expensive
  { pattern: /^\/api\/reflex\/scan$/,      limit: 5,   windowMs: 60_000  }, // full scan — heavy
  { pattern: /^\/api\/reflex\//,           limit: 30,  windowMs: 60_000  }, // other reflex ops
  { pattern: /^\/api\/metabolism-scan$/,   limit: 5,   windowMs: 60_000  },
  { pattern: /^\/api\//,                   limit: 100, windowMs: 60_000  }, // default for all /api/*
];

function resolveLimit(pathname: string): { limit: number; windowMs: number } {
  for (const r of LIMITS) {
    if (r.pattern.test(pathname)) return r;
  }
  return { limit: 100, windowMs: 60_000 };
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function check(ip: string, pathname: string): { allowed: boolean; remaining: number; resetAt: number; limit: number } {
  const { limit, windowMs } = resolveLimit(pathname);
  const now = Date.now();
  const mapKey = `${ip}:${pathname}`;
  const bucket = buckets.get(mapKey);

  if (!bucket || now >= bucket.resetAt) {
    // New or expired window — start fresh
    buckets.set(mapKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs, limit };
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    limit,
  };
}

// Purge stale entries every 5 minutes to prevent memory leak
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (now >= bucket.resetAt) buckets.delete(key);
    }
  }, 5 * 60_000);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only rate-limit API routes
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  const ip = getIp(req);
  const { allowed, remaining, resetAt, limit } = check(ip, pathname);

  const headers = {
    "X-RateLimit-Limit":     String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset":     String(Math.ceil(resetAt / 1000)),
  };

  if (!allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message: "Too many requests — slow down.",
        retryAfterMs: Math.max(0, resetAt - Date.now()),
      },
      {
        status: 429,
        headers: {
          ...headers,
          "Retry-After": String(Math.ceil(Math.max(0, resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  const res = NextResponse.next();
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
