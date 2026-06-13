import mongoose from "mongoose";
import { ExternalApiError } from "@helix/shared";

let cached: typeof mongoose | null = null;

export async function connectDb(): Promise<typeof mongoose> {
  if (cached) return cached;

  const uri = process.env["MONGODB_URI"];
  const dbName = process.env["MONGODB_DB"] ?? "helix";

  if (!uri) {
    throw new ExternalApiError("MONGODB_URI environment variable is not set", "mongodb");
  }

  try {
    cached = await mongoose.connect(uri, { dbName });
    return cached;
  } catch (err) {
    throw new ExternalApiError(
      `MongoDB connection failed: ${err instanceof Error ? err.message : String(err)}`,
      "mongodb",
    );
  }
}

export async function disconnectDb(): Promise<void> {
  if (cached) {
    await mongoose.disconnect();
    cached = null;
  }
}
