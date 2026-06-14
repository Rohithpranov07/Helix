import mongoose, { Schema, model, type Model } from "mongoose";
import type { ImmuneScanRun } from "@helix/shared";

const immuneFindingSchema = new Schema(
  {
    vulnClass: { type: String, required: true },
    endpoint: { type: String, required: true },
    evidence: { type: String, required: true },
    affectedFile: { type: String, required: true },
    diff: { type: String, default: "" },
    newContent: { type: String, default: "" },
  },
  { _id: false },
);

const immuneScanRunSchema = new Schema(
  {
    scanId: { type: String, required: true, unique: true, index: true },
    githubOwner: { type: String, required: true },
    githubRepo: { type: String, required: true },
    shadowBranch: { type: String, required: true },
    scannedAt: { type: String, required: true },
    findings: { type: [immuneFindingSchema], required: true },
    status: {
      type: String,
      enum: ["pending_approval", "approved", "rejected", "pr_created"],
      required: true,
      default: "pending_approval",
    },
    prUrl: { type: String },
    prNumber: { type: Number },
  },
  { collection: "immune_scan_run", timestamps: false },
);

export const ImmuneScanRunModel: Model<ImmuneScanRun> =
  (mongoose.models["ImmuneScanRun"] as Model<ImmuneScanRun> | undefined) ??
  (model("ImmuneScanRun", immuneScanRunSchema) as unknown as Model<ImmuneScanRun>);
