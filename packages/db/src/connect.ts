import mongoose from "mongoose";
import { ExternalApiError } from "@helix/shared";

// Global cache survives Next.js hot-reloads in dev mode.
// In production this is just a module singleton.
declare global {
  var __helixMongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
    hooked?: boolean;
  };
}

if (!global.__helixMongoose) {
  global.__helixMongoose = { conn: null, promise: null };
}

const cache = global.__helixMongoose;

// Release the pool the moment this process is told to stop (Ctrl+C, dev-server
// restart, deploy rollover) so its connections free immediately instead of
// lingering as half-open sockets the cluster has to reap — the main reason a
// free-tier cluster's connection count "climbs and stays high" after repeated
// dev restarts. Registered exactly once per process.
if (!cache.hooked) {
  cache.hooked = true;
  const release = async () => {
    try {
      await mongoose.connection.close(false);
    } catch {
      // best-effort — we're shutting down anyway
    }
  };
  process.once("SIGINT", () => void release().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void release().finally(() => process.exit(0)));
}

export async function connectDb(): Promise<typeof mongoose> {
  // Already connected and connection is alive
  if (cache.conn && mongoose.connection.readyState === 1) {
    return cache.conn;
  }

  // Connection in progress — wait for it
  if (cache.promise) {
    cache.conn = await cache.promise;
    return cache.conn;
  }

  const uri = process.env["MONGODB_URI"];
  const dbName = process.env["MONGODB_DB"] ?? "helix";

  if (!uri) {
    throw new ExternalApiError("MONGODB_URI environment variable is not set", "mongodb");
  }

  cache.promise = mongoose
    .connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
      // M0 free tier cap is ~500 total connections, shared across EVERY process
      // that points at this cluster (each `next dev`, deploy, script, etc. holds
      // its own pool). Keep each pool tiny.
      maxPoolSize: 5,
      // Keep ONE connection permanently warm. Without this, the pool drains
      // between spaced-out operations (dashboard polls, genome scan steps) and
      // every one pays a fresh handshake — the reconnect *churn* whose closing
      // sockets pile up on the cluster as a climbing connection count. One warm
      // socket reused for everything = flat, low, fast (MongoDB's own guidance
      // for churn/latency is minPoolSize > 0).
      //
      // The original max-connections blowup was NOT this — it was dozens of
      // orphaned dev-server processes each holding a pool. That's handled
      // separately by the SIGINT/SIGTERM pool-close above + killing zombies, so
      // a single well-behaved process keeping one connection is correct here.
      minPoolSize: 1,
      // Prune any connections opened above minPoolSize (e.g. a scan burst) once
      // they've been idle a minute; the one minPoolSize connection stays.
      maxIdleTimeMS: 60_000,
      waitQueueTimeoutMS: 5_000,
      // Tag connections so they're identifiable per-process in Atlas → Metrics →
      // Connections, which is how you spot a leaking process.
      appName: process.env["HELIX_DB_APP_NAME"] ?? "helix",
      // Don't buffer ops when disconnected — fail fast instead of piling up
      bufferCommands: false,
    })
    .then((m) => {
      cache.conn = m;
      cache.promise = null;
      return m;
    })
    .catch((err) => {
      cache.promise = null;
      cache.conn = null;
      throw new ExternalApiError(
        `MongoDB connection failed: ${err instanceof Error ? err.message : String(err)}`,
        "mongodb",
      );
    });

  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectDb(): Promise<void> {
  if (cache.conn) {
    await mongoose.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}
