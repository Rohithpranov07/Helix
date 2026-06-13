import mongoose, { Schema, model, type Model } from "mongoose";
import type { Antibody } from "@helix/shared";

const antibodySchema = new Schema(
  {
    antibodyId: { type: String, required: true, unique: true, index: true },
    sourceType: { type: String, required: true, enum: ["vuln", "incident"] },
    signature: { type: String, required: true },
    embedding: { type: [Number], required: true },
    regressionTest: { type: String, required: true },
    runtimeAssertion: { type: String, required: true },
    mintedAt: { type: String, required: true },
    recurrencesBlocked: { type: Number, required: true, default: 0 },
  },
  { collection: "antibody", timestamps: false },
);

export const AntibodyModel: Model<Antibody> =
  (mongoose.models["Antibody"] as Model<Antibody> | undefined) ??
  (model("Antibody", antibodySchema) as unknown as Model<Antibody>);
