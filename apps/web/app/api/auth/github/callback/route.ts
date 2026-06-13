/**
 * GET /api/auth/github/callback?code=<code>&state=<state>
 * GitHub OAuth callback. Exchanges code → token, fetches repo info,
 * persists GitHubConnection to MongoDB, redirects to dashboard.
 *
 * Required env: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
 */
import { NextResponse } from "next/server";
import { connectDb, upsertGitHubConnection } from "@helix/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateB64 = searchParams.get("state") ?? "";

  if (!code) {
    return NextResponse.redirect("/?error=github_oauth_cancelled");
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
    return NextResponse.redirect("/?error=invalid_oauth_state");
  }

  try {
    // Exchange code for access token
    const { exchangeCode, getRepo, getAuthenticatedUser } = await import(
      "@helix/engine/src/genome/github.js"
    );
    const token = await exchangeCode(clientId, clientSecret, code);

    // Get authenticated user (validates token)
    const user = await getAuthenticatedUser(token);
    const effectiveOwner = owner || user.login;

    // Get repo info (default branch)
    const repoInfo = await getRepo(token, effectiveOwner, repo || effectiveOwner);

    // Persist connection
    await connectDb();
    await upsertGitHubConnection({
      owner: effectiveOwner,
      repo: repo || effectiveOwner,
      accessToken: token,
      defaultBranch: repoInfo.default_branch,
      connectedAt: new Date().toISOString(),
    });

    return NextResponse.redirect(
      `/?github_connected=${encodeURIComponent(`${effectiveOwner}/${repo || effectiveOwner}`)}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(`/?error=${encodeURIComponent(msg.slice(0, 200))}`);
  }
}
