import type { GitHubConnection } from "@helix/shared";
import { GitHubConnectionModel } from "../models/githubConnection.js";
import type { HelixDoc } from "./intentStrand.js";

function toDoc(raw: Record<string, unknown>): HelixDoc<GitHubConnection> {
  const { _id, __v, ...rest } = raw;
  return { ...(rest as unknown as GitHubConnection), _id: String(_id) };
}

export async function upsertGitHubConnection(
  data: GitHubConnection,
): Promise<HelixDoc<GitHubConnection>> {
  const doc = await GitHubConnectionModel.findOneAndUpdate(
    { owner: data.owner, repo: data.repo },
    data,
    { upsert: true, new: true },
  ).lean();
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function findGitHubConnection(
  owner: string,
  repo: string,
): Promise<HelixDoc<GitHubConnection> | null> {
  const doc = await GitHubConnectionModel.findOne({ owner, repo }).lean();
  if (!doc) return null;
  return toDoc(doc as unknown as Record<string, unknown>);
}

export async function listGitHubConnections(): Promise<HelixDoc<GitHubConnection>[]> {
  const docs = await GitHubConnectionModel.find().lean();
  return docs.map((d) => toDoc(d as unknown as Record<string, unknown>));
}

export async function deleteGitHubConnection(owner: string, repo: string): Promise<void> {
  await GitHubConnectionModel.deleteOne({ owner, repo });
}
