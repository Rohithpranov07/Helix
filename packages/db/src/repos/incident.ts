import type { Incident } from "@helix/shared";
import { IncidentSchema, ValidationError } from "@helix/shared";
import { IncidentModel } from "../models/incident.js";
import type { HelixDoc } from "./intentStrand.js";

function toDoc(raw: Record<string, unknown>): HelixDoc<Incident> {
  const { _id, __v, ...rest } = raw;
  return { ...(rest as unknown as Incident), _id: String(_id) };
}

export async function createIncident(data: Incident): Promise<HelixDoc<Incident>> {
  const parsed = IncidentSchema.safeParse(data);
  if (!parsed.success) throw new ValidationError("Invalid incident data", parsed.error);
  const doc = await IncidentModel.create(data);
  return toDoc(doc.toObject() as unknown as Record<string, unknown>);
}

export async function findIncidentById(id: string): Promise<HelixDoc<Incident> | null> {
  const doc = await IncidentModel.findById(id).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function findIncidentByIncidentId(
  incidentId: string,
): Promise<HelixDoc<Incident> | null> {
  const doc = await IncidentModel.findOne({ incidentId }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function updateIncident(
  id: string,
  data: Partial<Incident>,
): Promise<HelixDoc<Incident> | null> {
  const doc = await IncidentModel.findByIdAndUpdate(id, data, { new: true }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function listIncidents(
  filter: Partial<Incident> = {},
): Promise<HelixDoc<Incident>[]> {
  const docs = await IncidentModel.find(filter).lean();
  return docs.map((d) => toDoc(d as unknown as Record<string, unknown>));
}
