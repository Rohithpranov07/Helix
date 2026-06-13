import mongoose, { Schema, model, type Model } from "mongoose";
import type { Homeostasis } from "@helix/shared";

const homeostasisSchema = new Schema(
  {
    window: { type: String, required: true },
    generationRate: { type: Number, required: true },
    repairRate: { type: Number, required: true },
    balance: { type: Number, required: true },
    action: { type: String, required: true, enum: ["ok", "reprioritise", "gate"] },
    hottestZones: { type: [String], required: true },
  },
  { collection: "homeostasis", timestamps: false },
);

export const HomeostasisModel: Model<Homeostasis> =
  (mongoose.models["Homeostasis"] as Model<Homeostasis> | undefined) ??
  (model("Homeostasis", homeostasisSchema) as unknown as Model<Homeostasis>);
