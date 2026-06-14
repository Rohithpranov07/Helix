import mongoose, { Schema, model, type Model } from "mongoose";
import type { IncidentPatch } from "@helix/shared";

const causalStepSchema = new Schema(
  { order: { type: Number, required: true }, description: { type: String, required: true }, evidenceRef: { type: String, required: true } },
  { _id: false },
);

const incidentPatchFileSchema = new Schema(
  { path: { type: String, required: true }, diff: { type: String, required: true }, newContent: { type: String, required: true } },
  { _id: false },
);

const incidentPatchSchema = new Schema(
  {
    patchId: { type: String, required: true, unique: true, index: true },
    incidentId: { type: String, required: true, index: true },
    githubOwner: { type: String, required: true },
    githubRepo: { type: String, required: true },
    railwayProjectId: { type: String, required: true },
    railwayDeploymentId: { type: String, required: true },
    deploymentStatus: { type: String, required: true },
    shadowBranch: { type: String, required: true },
    detectedAt: { type: String, required: true },
    failureSummary: { type: String, required: true },
    causalChain: { type: [causalStepSchema], required: true },
    files: { type: [incidentPatchFileSchema], required: true },
    status: {
      type: String,
      enum: ["pending_approval", "approved", "rejected", "pr_created"],
      required: true,
      default: "pending_approval",
    },
    prUrl: { type: String },
    prNumber: { type: Number },
  },
  { collection: "incident_patch", timestamps: false },
);

export const IncidentPatchModel: Model<IncidentPatch> =
  (mongoose.models["IncidentPatch"] as Model<IncidentPatch> | undefined) ??
  (model("IncidentPatch", incidentPatchSchema) as unknown as Model<IncidentPatch>);
