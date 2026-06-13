import type { ShadowProof } from "@helix/shared";
import { ShadowProofSchema, ValidationError } from "@helix/shared";
import { ShadowProofModel } from "../models/shadowProof.js";
import type { HelixDoc } from "./intentStrand.js";

function toDoc(raw: Record<string, unknown>): HelixDoc<ShadowProof> {
  const { _id, __v, ...rest } = raw;
  return { ...(rest as unknown as ShadowProof), _id: String(_id) };
}

export async function createShadowProof(data: ShadowProof): Promise<HelixDoc<ShadowProof>> {
  const parsed = ShadowProofSchema.safeParse(data);
  if (!parsed.success) throw new ValidationError("Invalid shadow_proof data", parsed.error);
  const doc = await ShadowProofModel.create(data);
  return toDoc(doc.toObject() as unknown as Record<string, unknown>);
}

export async function findShadowProofById(id: string): Promise<HelixDoc<ShadowProof> | null> {
  const doc = await ShadowProofModel.findById(id).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function findShadowProofByProofId(
  proofId: string,
): Promise<HelixDoc<ShadowProof> | null> {
  const doc = await ShadowProofModel.findOne({ proofId }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function updateShadowProof(
  id: string,
  data: Partial<ShadowProof>,
): Promise<HelixDoc<ShadowProof> | null> {
  const doc = await ShadowProofModel.findByIdAndUpdate(id, data, { new: true }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function listShadowProofs(
  filter: Partial<ShadowProof> = {},
): Promise<HelixDoc<ShadowProof>[]> {
  const docs = await ShadowProofModel.find(filter).lean();
  return docs.map((d) => toDoc(d as unknown as Record<string, unknown>));
}
