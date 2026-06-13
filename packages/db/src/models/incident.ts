import mongoose, { Schema, model, type Model } from "mongoose";
import type { Incident } from "@helix/shared";

const causalStepSchema = new Schema(
  { order: { type: Number, required: true }, description: { type: String, required: true }, evidenceRef: { type: String, required: true } },
  { _id: false },
);

const incidentSchema = new Schema(
  {
    incidentId: { type: String, required: true, unique: true, index: true },
    deployId: { type: String, required: true },
    detectedAt: { type: String, required: true },
    baselineDelta: { type: Number, required: true },
    rollbackAt: { type: String },
    causalChain: { type: [causalStepSchema], required: true },
    failingRequest: { type: Schema.Types.Mixed, required: true },
    shadowProof: { type: String },
    fixRef: { type: String },
    antibodyId: { type: String },
    userImpactSeconds: { type: Number, required: true },
  },
  { collection: "incident", timestamps: false },
);

export const IncidentModel: Model<Incident> =
  (mongoose.models["Incident"] as Model<Incident> | undefined) ??
  (model("Incident", incidentSchema) as unknown as Model<Incident>);
