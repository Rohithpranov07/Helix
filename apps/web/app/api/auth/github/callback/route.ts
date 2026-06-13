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
    return NextResponse.redirect(`${origin}/?error=github_oauth_cancelled`);
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
    return NextResponse.redirect(`${origin}/?error=invalid_oauth_state`);
  }

  try {
    const { exchangeCode, getRepo, getAuthenticatedUser } = await import(
      "@helix/engine/src/genome/github.js"
    );
    const token = await exchangeCode(clientId, clientSecret, code);

    // Get authenticated user (validates token + provides login for owner fallback)
    const user = await getAuthenticatedUser(token);
    const effectiveOwner = owner || user.login;
    const effectiveRepo = repo || effectiveOwner;

    // Get repo info (default branch)
    const repoInfo = await getRepo(token, effectiveOwner, effectiveRepo);

    // Persist connection
    await connectDb();
    await upsertGitHubConnection({
      owner: effectiveOwner,
      repo: effectiveRepo,
      accessToken: token,
      defaultBranch: repoInfo.default_branch,
      connectedAt: new Date().toISOString(),
    });

    return NextResponse.redirect(
      `${origin}/?github_connected=${encodeURIComponent(`${effectiveOwner}/${effectiveRepo}`)}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      `${origin}/?error=${encodeURIComponent(msg.slice(0, 200))}`,
    );
  }
}
