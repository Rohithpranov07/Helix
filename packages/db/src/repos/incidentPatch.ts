import type { IncidentPatch, IncidentPatchStatus } from "@helix/shared";
import { IncidentPatchModel } from "../models/incidentPatch.js";
import type { HelixDoc } from "./intentStrand.js";

function toDoc(raw: Record<string, unknown>): HelixDoc<IncidentPatch> {
  const { _id, __v, ...rest } = raw;
  return { ...(rest as unknown as IncidentPatch), _id: String(_id) };
}

export async function createIncidentPatch(data: IncidentPatch): Promise<HelixDoc<IncidentPatch>> {
  const doc = await IncidentPatchModel.create(data);
  return toDoc(doc.toObject() as unknown as Record<string, unknown>);
}

export async function findIncidentPatchByPatchId(
  patchId: string,
): Promise<HelixDoc<IncidentPatch> | null> {
  const doc = await IncidentPatchModel.findOne({ patchId }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function updateIncidentPatch(
  patchId: string,
  data: Partial<IncidentPatch>,
): Promise<HelixDoc<IncidentPatch> | null> {
  const doc = await IncidentPatchModel.findOneAndUpdate({ patchId }, data, { new: true }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function listIncidentPatches(
  filter: Partial<Pick<IncidentPatch, "status" | "githubOwner" | "githubRepo" | "railwayProjectId">> = {},
): Promise<HelixDoc<IncidentPatch>[]> {
  const docs = await IncidentPatchModel.find(
    filter as Record<string, unknown>,
  ).sort({ detectedAt: -1 }).lean();
  return docs.map((d) => toDoc(d as unknown as Record<string, unknown>));
}

export type { IncidentPatchStatus };
