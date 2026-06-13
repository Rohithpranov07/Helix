import mongoose, { Schema, model, type Model } from "mongoose";
import type { GitHubConnection } from "@helix/shared";

const githubConnectionSchema = new Schema(
  {
    owner: { type: String, required: true },
    repo: { type: String, required: true },
    accessToken: { type: String, required: true },
    defaultBranch: { type: String, required: true, default: "main" },
    connectedAt: { type: String, required: true },
  },
  { collection: "github_connection", timestamps: false },
);

githubConnectionSchema.index({ owner: 1, repo: 1 }, { unique: true });

export const GitHubConnectionModel: Model<GitHubConnection> =
  (mongoose.models["GitHubConnection"] as Model<GitHubConnection> | undefined) ??
  (model("GitHubConnection", githubConnectionSchema) as unknown as Model<GitHubConnection>);
