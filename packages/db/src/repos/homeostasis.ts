import type { Homeostasis } from "@helix/shared";
import { ValidationError } from "@helix/shared";
import { HomeostasisModel } from "../models/homeostasis.js";
import type { HelixDoc } from "./intentStrand.js";
import { z } from "zod";

const HomeostasisSchema = z.object({
  window: z.string(),
  generationRate: z.number(),
  repairRate: z.number(),
  balance: z.number(),
  action: z.enum(["ok", "reprioritise", "gate"]),
  hottestZones: z.array(z.string()),
});

function toDoc(raw: Record<string, unknown>): HelixDoc<Homeostasis> {
  const { _id, __v, ...rest } = raw;
  return { ...(rest as unknown as Homeostasis), _id: String(_id) };
}

export async function createHomeostasis(data: Homeostasis): Promise<HelixDoc<Homeostasis>> {
  const parsed = HomeostasisSchema.safeParse(data);
  if (!parsed.success) throw new ValidationError("Invalid homeostasis data", parsed.error);
  const doc = await HomeostasisModel.create(data);
  return toDoc(doc.toObject() as unknown as Record<string, unknown>);
}

export async function findHomeostasisById(id: string): Promise<HelixDoc<Homeostasis> | null> {
  const doc = await HomeostasisModel.findById(id).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function updateHomeostasis(
  id: string,
  data: Partial<Homeostasis>,
): Promise<HelixDoc<Homeostasis> | null> {
  const doc = await HomeostasisModel.findByIdAndUpdate(id, data, { new: true }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function listHomeostasis(
  filter: Partial<Homeostasis> = {},
): Promise<HelixDoc<Homeostasis>[]> {
  const docs = await HomeostasisModel.find(filter).lean();
  return docs.map((d) => toDoc(d as unknown as Record<string, unknown>));
}
