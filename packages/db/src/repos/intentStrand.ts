import type { IntentStrand } from "@helix/shared";
import { IntentStrandSchema, ValidationError } from "@helix/shared";
import { IntentStrandModel } from "../models/intentStrand.js";

export type HelixDoc<T> = T & { _id: string };

function toDoc(raw: Record<string, unknown>): HelixDoc<IntentStrand> {
  const { _id, __v, ...rest } = raw;
  return { ...(rest as unknown as IntentStrand), _id: String(_id) };
}

export async function createIntentStrand(
  data: IntentStrand,
): Promise<HelixDoc<IntentStrand>> {
  const parsed = IntentStrandSchema.safeParse(data);
  if (!parsed.success) throw new ValidationError("Invalid intent_strand data", parsed.error);
  const doc = await IntentStrandModel.create(data);
  return toDoc(doc.toObject() as unknown as Record<string, unknown>);
}

export async function findIntentStrandById(id: string): Promise<HelixDoc<IntentStrand> | null> {
  const doc = await IntentStrandModel.findById(id).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function updateIntentStrand(
  id: string,
  data: Partial<IntentStrand>,
): Promise<HelixDoc<IntentStrand> | null> {
  const doc = await IntentStrandModel.findByIdAndUpdate(id, data, { new: true }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function listIntentStrands(
  filter: Partial<IntentStrand> = {},
): Promise<HelixDoc<IntentStrand>[]> {
  const docs = await IntentStrandModel.find(filter).lean();
  return docs.map((d) => toDoc(d as unknown as Record<string, unknown>));
}
