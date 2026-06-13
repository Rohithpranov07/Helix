import mongoose, { Schema, model, type Model } from "mongoose";
import type { ShadowProof } from "@helix/shared";

const shadowProofSchema = new Schema(
  {
    proofId: { type: String, required: true, unique: true, index: true },
    changeRef: { type: String, required: true },
    replayedCases: { type: Number, required: true },
    intendedFixPassed: { type: Boolean, required: true },
    regressions: { type: Number, required: true },
    verdict: { type: String, required: true, enum: ["promote", "reject"] },
    verifiedAt: { type: String, required: true },
  },
  { collection: "shadow_proof", timestamps: false },
);

export const ShadowProofModel: Model<ShadowProof> =
  (mongoose.models["ShadowProof"] as Model<ShadowProof> | undefined) ??
  (model("ShadowProof", shadowProofSchema) as unknown as Model<ShadowProof>);
