/**
 * GitHub REST API client — typed wrappers over fetch.
 * Used by Genome organ to read repos, create shadow branches, and open PRs.
 * All endpoints verified against https://docs.github.com/en/rest (2022-11-28).
 */
import { ExternalApiError } from "@helix/shared";

const GH_API = "https://api.github.com";

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "HELIX-Genome/1.0",
    "Content-Type": "application/json",
  };
}

async function ghFetch<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${GH_API}${path}`, {
    method,
    headers: headers(token),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ExternalApiError(
      `GitHub ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`,
      "github",
      res.status,
    );
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ── Repo info ─────────────────────────────────────────────────────────────────

interface GHRepo {
  full_name: string;
  default_branch: string;
  private: boolean;
  size: number;
}

export async function getRepo(token: string, owner: string, repo: string): Promise<GHRepo> {
  return ghFetch<GHRepo>(token, "GET", `/repos/${owner}/${repo}`);
}

// ── File tree ─────────────────────────────────────────────────────────────────

export interface GHTreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
  sha: string;
}

interface GHTree {
  tree: GHTreeEntry[];
  truncated: boolean;
}

export async function getRepoTree(
  token: string,
  owner: string,
  repo: string,
  sha = "HEAD",
): Promise<GHTreeEntry[]> {
  const data = await ghFetch<GHTree>(
    token,
    "GET",
    `/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
  );
  return data.tree.filter((e) => e.type === "blob");
}

// ── File content ──────────────────────────────────────────────────────────────

interface GHContent {
  content: string;
  encoding: string;
  sha: string;
  size: number;
}

export async function readFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
): Promise<{ content: string; sha: string } | null> {
  try {
    const data = await ghFetch<GHContent>(
      token,
      "GET",
      `/repos/${owner}/${repo}/contents/${path}`,
    );
    if (data.encoding !== "base64") return null;
    const content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
    return { content, sha: data.sha };
  } catch (e) {
    if (e instanceof ExternalApiError && e.statusCode === 404) return null;
    throw e;
  }
}

// ── Branch management ─────────────────────────────────────────────────────────

interface GHRef {
  ref: string;
  object: { sha: string };
}

export async function getDefaultBranchSha(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<string> {
  const data = await ghFetch<GHRef>(
    token,
    "GET",
    `/repos/${owner}/${repo}/git/refs/heads/${branch}`,
  );
  return data.object.sha;
}

export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  fromSha: string,
): Promise<void> {
  await ghFetch(token, "POST", `/repos/${owner}/${repo}/git/refs`, {
    ref: `refs/heads/${branch}`,
    sha: fromSha,
  });
}

// ── Write file ────────────────────────────────────────────────────────────────

export async function writeFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
  fileSha?: string,
): Promise<void> {
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content).toString("base64"),
    branch,
  };
  if (fileSha) body["sha"] = fileSha;
  await ghFetch(
    token,
    "PUT",
    `/repos/${owner}/${repo}/contents/${path}`,
    body,
  );
}

// ── Pull Request ──────────────────────────────────────────────────────────────

interface GHPR {
  html_url: string;
  number: number;
}

export async function createPR(
  token: string,
  owner: string,
  repo: string,
  head: string,
  base: string,
  title: string,
  body: string,
): Promise<{ html_url: string; number: number }> {
  return ghFetch<GHPR>(token, "POST", `/repos/${owner}/${repo}/pulls`, {
    title,
    body,
    head,
    base,
  });
}

// ── OAuth token exchange ───────────────────────────────────────────────────────

interface GHTokenRes {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "HELIX-Genome/1.0",
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const data = (await res.json()) as GHTokenRes;
  if (!data.access_token) {
    throw new ExternalApiError(
      `GitHub OAuth failed: ${data.error_description ?? data.error ?? "unknown"}`,
      "github",
      res.status,
    );
  }
  return data.access_token;
}

// ── Authenticated user ────────────────────────────────────────────────────────

interface GHUser {
  login: string;
  name: string;
}

export async function getAuthenticatedUser(token: string): Promise<GHUser> {
  return ghFetch<GHUser>(token, "GET", "/user");
}
