import type { ImmuneScanRun, ImmunePatchStatus } from "@helix/shared";
import { ImmuneScanRunModel } from "../models/immuneScanRun.js";
import type { HelixDoc } from "./intentStrand.js";

function toDoc(raw: Record<string, unknown>): HelixDoc<ImmuneScanRun> {
  const { _id, __v, ...rest } = raw;
  return { ...(rest as unknown as ImmuneScanRun), _id: String(_id) };
}

export async function createImmuneScanRun(data: ImmuneScanRun): Promise<HelixDoc<ImmuneScanRun>> {
  const doc = await ImmuneScanRunModel.create(data);
  return toDoc(doc.toObject() as unknown as Record<string, unknown>);
}

export async function findImmuneScanRunByScanId(
  scanId: string,
): Promise<HelixDoc<ImmuneScanRun> | null> {
  const doc = await ImmuneScanRunModel.findOne({ scanId }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function updateImmuneScanRun(
  scanId: string,
  data: Partial<ImmuneScanRun>,
): Promise<HelixDoc<ImmuneScanRun> | null> {
  const doc = await ImmuneScanRunModel.findOneAndUpdate({ scanId }, data, { new: true }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function listImmuneScanRuns(
  filter: Partial<Pick<ImmuneScanRun, "status" | "githubOwner" | "githubRepo">> = {},
): Promise<HelixDoc<ImmuneScanRun>[]> {
  const docs = await ImmuneScanRunModel.find(
    filter as Record<string, unknown>,
  ).sort({ scannedAt: -1 }).lean();
  return docs.map((d) => toDoc(d as unknown as Record<string, unknown>));
}

export type { ImmunePatchStatus };
