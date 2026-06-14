import mongoose, { Schema, model, type Model } from "mongoose";
import type { MetabolismRun } from "@helix/shared";

const enzymeSchema = new Schema(
  {
    enzymeType: { type: String, required: true },
    targetZone: { type: String, required: true },
    rationale: { type: String, required: true },
    diff: { type: String, default: "" },
    newContent: { type: String, default: "" },
  },
  { _id: false },
);

const metabolismRunSchema = new Schema(
  {
    runId: { type: String, required: true, unique: true, index: true },
    githubOwner: { type: String, required: true },
    githubRepo: { type: String, required: true },
    shadowBranch: { type: String, required: true },
    measuredAt: { type: String, required: true },
    temperature: { type: Number, required: true },
    dims: {
      type: new Schema(
        {
          duplication: { type: Number, required: true },
          patternVariance: { type: Number, required: true },
          coupling: { type: Number, required: true },
          vulnDensity: { type: Number, required: true },
          comprehension: { type: Number, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    projectedRewriteWeeks: { type: Number, required: true },
    enzymes: { type: [enzymeSchema], required: true },
    status: {
      type: String,
      enum: ["pending_approval", "approved", "rejected", "pr_created"],
      required: true,
      default: "pending_approval",
    },
    prUrl: { type: String },
    prNumber: { type: Number },
  },
  { collection: "metabolism_run", timestamps: false },
);

export const MetabolismRunModel: Model<MetabolismRun> =
  (mongoose.models["MetabolismRun"] as Model<MetabolismRun> | undefined) ??
  (model("MetabolismRun", metabolismRunSchema) as unknown as Model<MetabolismRun>);
