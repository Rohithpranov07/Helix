import type { MetabolismRun, MetabolismStatus } from "@helix/shared";
import { MetabolismRunModel } from "../models/metabolismRun.js";
import type { HelixDoc } from "./intentStrand.js";

function toDoc(raw: Record<string, unknown>): HelixDoc<MetabolismRun> {
  const { _id, __v, ...rest } = raw;
  return { ...(rest as unknown as MetabolismRun), _id: String(_id) };
}

export async function createMetabolismRun(
  data: MetabolismRun,
): Promise<HelixDoc<MetabolismRun>> {
  const doc = await MetabolismRunModel.create(data);
  return toDoc(doc.toObject() as unknown as Record<string, unknown>);
}

export async function findMetabolismRunByRunId(
  runId: string,
): Promise<HelixDoc<MetabolismRun> | null> {
  const doc = await MetabolismRunModel.findOne({ runId }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function updateMetabolismRun(
  runId: string,
  data: Partial<MetabolismRun>,
): Promise<HelixDoc<MetabolismRun> | null> {
  const doc = await MetabolismRunModel.findOneAndUpdate({ runId }, data, { new: true }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function listMetabolismRuns(
  filter: Partial<Pick<MetabolismRun, "status" | "githubOwner" | "githubRepo">> = {},
): Promise<HelixDoc<MetabolismRun>[]> {
  const docs = await MetabolismRunModel.find(
    filter as Record<string, unknown>,
  ).sort({ measuredAt: -1 }).limit(50).lean();
  return docs.map((d) => toDoc(d as unknown as Record<string, unknown>));
}

export type { MetabolismStatus };
