import mongoose from "mongoose";
import { ExternalApiError } from "@helix/shared";

/**
 * Creates entropy_timeseries as a MongoDB time-series collection if it does not exist.
 * Must be called after connectDb() and before inserting entropy points.
 */
export async function ensureTimeSeriesCollection(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new ExternalApiError("No active MongoDB connection", "mongodb");
  }

  const collections = await db.listCollections({ name: "entropy_timeseries" }).toArray();
  if (collections.length > 0) return; // already exists

  await db.createCollection("entropy_timeseries", {
    timeseries: {
      timeField: "ts",
      granularity: "hours",
    },
  });
}
