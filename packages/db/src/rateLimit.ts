import mongoose, { Schema, type Model } from "mongoose";
import { connectDb } from "./connect.js";

// ── Schema ─────────────────────────────────────────────────────────────────────
// One doc per (key × fixed time-window). MongoDB's TTL index auto-expires old docs.

interface RateLimitDoc {
  _id: string;            // "{key}:{windowStart}" — atomic upsert key
  key: string;            // e.g. "ip:1.2.3.4:/api/vitals"
  count: number;
  expiresAt: Date;        // TTL index fires here; same as window end
}

const rateLimitSchema = new Schema<RateLimitDoc>(
  {
    _id:       { type: String },
    key:       { type: String, required: true, index: true },
    count:     { type: Number, required: true, default: 1 },
    expiresAt: { type: Date,   required: true },
  },
  { versionKey: false },
);

// MongoDB removes the document automatically when expiresAt is reached
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

function getRateLimitModel(): Model<RateLimitDoc> {
  return (
    (mongoose.models["RateLimit"] as Model<RateLimitDoc> | undefined) ??
    mongoose.model<RateLimitDoc>("RateLimit", rateLimitSchema, "rate_limit")
  );
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}

/**
 * Sliding-window (fixed-bucket) rate limiter backed by MongoDB.
 *
 * Atomic: uses findOneAndUpdate + $inc so concurrent requests never race.
 * Persistent: survives server restarts; expired docs are cleaned up by Atlas TTL.
 *
 * @param key       Identifier — typically "ip:<ip>:<pathname>"
 * @param limit     Max requests allowed per window
 * @param windowMs  Window size in milliseconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  await connectDb();

  const now = Date.now();
  // Snap to a fixed bucket so all requests within the same window share one doc
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = new Date(windowStart + windowMs);
  const docId = `${key}:${windowStart}`;

  const Model = getRateLimitModel();

  const doc = await Model.findOneAndUpdate(
    { _id: docId },
    {
      $inc: { count: 1 },
      $setOnInsert: { key, expiresAt: resetAt },
    },
    { upsert: true, new: true },
  ).lean();

  const count = doc?.count ?? 1;

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}
