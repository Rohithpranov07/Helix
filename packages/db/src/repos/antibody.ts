import type { Antibody } from "@helix/shared";
import { AntibodySchema, ValidationError } from "@helix/shared";
import { AntibodyModel } from "../models/antibody.js";
import type { HelixDoc } from "./intentStrand.js";

function toDoc(raw: Record<string, unknown>): HelixDoc<Antibody> {
  const { _id, __v, ...rest } = raw;
  return { ...(rest as unknown as Antibody), _id: String(_id) };
}

export async function createAntibody(data: Antibody): Promise<HelixDoc<Antibody>> {
  const parsed = AntibodySchema.safeParse(data);
  if (!parsed.success) throw new ValidationError("Invalid antibody data", parsed.error);
  const doc = await AntibodyModel.create(data);
  return toDoc(doc.toObject() as unknown as Record<string, unknown>);
}

export async function findAntibodyById(id: string): Promise<HelixDoc<Antibody> | null> {
  const doc = await AntibodyModel.findById(id).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function findAntibodyByAntibodyId(
  antibodyId: string,
): Promise<HelixDoc<Antibody> | null> {
  const doc = await AntibodyModel.findOne({ antibodyId }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function updateAntibody(
  id: string,
  data: Partial<Antibody>,
): Promise<HelixDoc<Antibody> | null> {
  const doc = await AntibodyModel.findByIdAndUpdate(id, data, { new: true }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function listAntibodies(
  filter: Partial<Antibody> = {},
): Promise<HelixDoc<Antibody>[]> {
  const docs = await AntibodyModel.find(filter).lean();
  return docs.map((d) => toDoc(d as unknown as Record<string, unknown>));
}
