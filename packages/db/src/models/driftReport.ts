import mongoose, { Schema, model, type Model } from "mongoose";
import type { DriftReport } from "@helix/shared";

const driftMismatchSchema = new Schema(
  {
    invariantId: { type: String, required: true },
    description: { type: String, required: true },
    affectedFile: { type: String, required: true },
    diff: { type: String, required: true },
    newContent: { type: String, required: true },
  },
  { _id: false },
);

const driftReportSchema = new Schema(
  {
    driftId: { type: String, required: true, unique: true, index: true },
    strandId: { type: String, required: true, index: true },
    githubOwner: { type: String, required: true },
    githubRepo: { type: String, required: true },
    shadowBranch: { type: String, required: true },
    detectedAt: { type: String, required: true },
    mismatches: { type: [driftMismatchSchema], required: true },
    status: {
      type: String,
      enum: ["pending_approval", "approved", "rejected", "pr_created"],
      required: true,
      default: "pending_approval",
    },
    prUrl: { type: String },
    prNumber: { type: Number },
  },
  { collection: "drift_report", timestamps: false },
);

export const DriftReportModel: Model<DriftReport> =
  (mongoose.models["DriftReport"] as Model<DriftReport> | undefined) ??
  (model("DriftReport", driftReportSchema) as unknown as Model<DriftReport>);
