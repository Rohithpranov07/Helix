import { NextResponse } from "next/server";
import { connectDb, upsertGitHubConnection } from "@helix/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin; // e.g. http://localhost:3000

  const { searchParams } = url;
  const code = searchParams.get("code");
  const stateB64 = searchParams.get("state") ?? "";

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard/genome?error=${encodeURIComponent("GitHub authorization was cancelled. Please try again.")}`);
  }

  const clientId = process.env["GITHUB_CLIENT_ID"];
  const clientSecret = process.env["GITHUB_CLIENT_SECRET"];

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not configured" },
      { status: 503 },
    );
  }

  // Decode state
  let owner = "";
  let repo = "";
  try {
    const state = JSON.parse(Buffer.from(stateB64, "base64url").toString()) as {
      owner?: string;
      repo?: string;
    };
    owner = state.owner ?? "";
    repo = state.repo ?? "";
  } catch {
    return NextResponse.redirect(`${origin}/dashboard/genome?error=${encodeURIComponent("Invalid OAuth state. Please try connecting again.")}`);
  }

  try {
    const { exchangeCode, getRepo, getAuthenticatedUser } = await import(
      "@helix/engine/src/genome/github.js"
    );
    const token = await exchangeCode(clientId, clientSecret, code);

    const user = await getAuthenticatedUser(token);
    const effectiveOwner = owner || user.login;
    const effectiveRepo = repo || effectiveOwner;

    const repoInfo = await getRepo(token, effectiveOwner, effectiveRepo);

    // Persist connection — non-fatal: auth succeeds even if DB is unavailable
    try {
      await connectDb();
      await upsertGitHubConnection({
        owner: effectiveOwner,
        repo: effectiveRepo,
        accessToken: token,
        defaultBranch: repoInfo.default_branch,
        connectedAt: new Date().toISOString(),
      });
    } catch (dbErr) {
      console.error("[HELIX] DB save failed (non-fatal):", dbErr);
    }

    return NextResponse.redirect(
      `${origin}/dashboard/genome?github_connected=${encodeURIComponent(`${effectiveOwner}/${effectiveRepo}`)}`,
    );
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[HELIX] GitHub OAuth callback error:", raw);
    const friendly = friendlyGitHubError(raw, owner, repo);
    return NextResponse.redirect(
      `${origin}/dashboard/genome?error=${encodeURIComponent(friendly)}`,
    );
  }
}

function friendlyGitHubError(raw: string, owner: string, repo: string): string {
  if (raw.includes("404"))
    return `Repository "${owner}/${repo}" not found. Check the URL and make sure it exists and you have access.`;
  if (raw.includes("401") || raw.includes("Bad credentials") || raw.includes("bad_verification_code"))
    return "GitHub authorization failed — the code may have expired. Please try connecting again.";
  if (raw.includes("403"))
    return `Access denied to "${owner}/${repo}". Make sure you granted the required permissions.`;
  if (raw.includes("GITHUB_CLIENT"))
    return "Server configuration error — GITHUB_CLIENT_ID or SECRET not set.";
  if (raw.includes("OAuth failed"))
    return "GitHub OAuth failed. Please try connecting again.";
  // Surface the raw message in dev so it's visible in the UI
  return `Connection error: ${raw.slice(0, 120)}`;
}
