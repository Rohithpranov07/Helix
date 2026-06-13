import mongoose, { Schema, model, type Model } from "mongoose";

// ts stored as Date in MongoDB (required for time-series timeField).
// Repos convert to/from ISO string to match the EntropyPoint domain type.
export interface EntropyPointDoc {
  ts: Date;
  temperature: number;
  dims: {
    duplication: number;
    patternVariance: number;
    coupling: number;
    vulnDensity: number;
    comprehension: number;
  };
  projectedRewriteWeeks: number;
}

const entropyTimeseriesSchema = new Schema(
  {
    ts: { type: Date, required: true },
    temperature: { type: Number, required: true },
    dims: {
      type: new Schema(
        { duplication: Number, patternVariance: Number, coupling: Number, vulnDensity: Number, comprehension: Number },
        { _id: false },
      ),
      required: true,
    },
    projectedRewriteWeeks: { type: Number, required: true },
  },
  // autoCreate: false — must be created as time-series via ensureCollections.ts
  { collection: "entropy_timeseries", timestamps: false, autoCreate: false, autoIndex: false },
);

export const EntropyTimeseriesModel: Model<EntropyPointDoc> =
  (mongoose.models["EntropyTimeseries"] as Model<EntropyPointDoc> | undefined) ??
  (model("EntropyTimeseries", entropyTimeseriesSchema) as unknown as Model<EntropyPointDoc>);
