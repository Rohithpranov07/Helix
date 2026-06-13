import mongoose, { Schema, model, type Model } from "mongoose";
import type { IntentStrand } from "@helix/shared";

const invariantSchema = new Schema(
  {
    id: { type: String, required: true },
    rule: { type: String, required: true },
    rationale: { type: String, required: true },
    compliance: { type: Boolean },
  },
  { _id: false },
);

const intentStrandSchema = new Schema(
  {
    moduleId: { type: String, required: true, index: true },
    purpose: { type: String, required: true },
    invariants: { type: [invariantSchema], required: true },
    edgeDecisions: { type: [String], required: true },
    sourcePrompt: { type: String, required: true },
    generatedBy: {
      type: new Schema({ model: String, version: String }, { _id: false }),
      required: true,
    },
    pairing: {
      type: new Schema(
        { score: Number, lastChecked: String, unpairedInvariants: [String] },
        { _id: false },
      ),
      required: true,
    },
  },
  { collection: "intent_strand", timestamps: false },
);

export const IntentStrandModel: Model<IntentStrand> =
  (mongoose.models["IntentStrand"] as Model<IntentStrand> | undefined) ??
  (model("IntentStrand", intentStrandSchema) as unknown as Model<IntentStrand>);
