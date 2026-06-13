import type { EntropyPoint } from "@helix/shared";
import { EntropyPointSchema, ValidationError } from "@helix/shared";
import { EntropyTimeseriesModel } from "../models/entropyTimeseries.js";
import type { HelixDoc } from "./intentStrand.js";

function toDoc(raw: Record<string, unknown>): HelixDoc<EntropyPoint> {
  const { _id, __v, ts, ...rest } = raw;
  const tsStr = ts instanceof Date ? ts.toISOString() : String(ts);
  return { ...(rest as unknown as Omit<EntropyPoint, "ts">), ts: tsStr, _id: String(_id) };
}

export async function createEntropyPoint(
  data: EntropyPoint,
): Promise<HelixDoc<EntropyPoint>> {
  const parsed = EntropyPointSchema.safeParse(data);
  if (!parsed.success) throw new ValidationError("Invalid entropy_timeseries data", parsed.error);
  const doc = await EntropyTimeseriesModel.create({ ...data, ts: new Date(data.ts) });
  return toDoc(doc.toObject() as unknown as Record<string, unknown>);
}

export async function findEntropyPointById(id: string): Promise<HelixDoc<EntropyPoint> | null> {
  const doc = await EntropyTimeseriesModel.findById(id).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function updateEntropyPoint(_id: string, _data: Partial<EntropyPoint>): Promise<never> {
  throw new ValidationError("entropy_timeseries is a time-series collection and does not support updates");
}

export async function listEntropyPoints(limit = 100): Promise<HelixDoc<EntropyPoint>[]> {
  const docs = await EntropyTimeseriesModel.find({}).sort({ ts: -1 }).limit(limit).lean();
  return docs.map((d) => toDoc(d as unknown as Record<string, unknown>));
}
