import type { DriftReport } from "@helix/shared";
import { DriftReportModel } from "../models/driftReport.js";
import type { HelixDoc } from "./intentStrand.js";

function toDoc(raw: Record<string, unknown>): HelixDoc<DriftReport> {
  const { _id, __v, ...rest } = raw;
  return { ...(rest as unknown as DriftReport), _id: String(_id) };
}

export async function createDriftReport(data: DriftReport): Promise<HelixDoc<DriftReport>> {
  const doc = await DriftReportModel.create(data);
  return toDoc(doc.toObject() as unknown as Record<string, unknown>);
}

export async function findDriftReportByDriftId(
  driftId: string,
): Promise<HelixDoc<DriftReport> | null> {
  const doc = await DriftReportModel.findOne({ driftId }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function updateDriftReport(
  driftId: string,
  data: Partial<DriftReport>,
): Promise<HelixDoc<DriftReport> | null> {
  const doc = await DriftReportModel.findOneAndUpdate({ driftId }, data, { new: true }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function listDriftReports(
  filter: Partial<Pick<DriftReport, "status" | "githubOwner" | "githubRepo">> = {},
): Promise<HelixDoc<DriftReport>[]> {
  const docs = await DriftReportModel.find(filter).sort({ detectedAt: -1 }).lean();
  return docs.map((d) => toDoc(d as unknown as Record<string, unknown>));
}
