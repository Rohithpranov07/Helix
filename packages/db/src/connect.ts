import mongoose from "mongoose";
import { ExternalApiError } from "@helix/shared";

// Global cache survives Next.js hot-reloads in dev mode.
// In production this is just a module singleton.
declare global {
  var __helixMongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

if (!global.__helixMongoose) {
  global.__helixMongoose = { conn: null, promise: null };
}

const cache = global.__helixMongoose;

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
