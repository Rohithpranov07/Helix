/**
 * GET /api/auth/github?owner=<owner>&repo=<repo>
 * Initiates GitHub OAuth flow. Redirects to GitHub authorization page.
 * Scope: repo (read code + create branches/PRs).
 *
 * Required env: GITHUB_CLIENT_ID, GITHUB_CALLBACK_URL
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const clientId = process.env["GITHUB_CLIENT_ID"];
  const { origin } = new URL(request.url);
  const callbackUrl =
    process.env["GITHUB_CALLBACK_URL"] ?? `${origin}/api/auth/github/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: "GITHUB_CLIENT_ID not configured" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner") ?? "";
  const repo = searchParams.get("repo") ?? "";

  // State encodes owner/repo so the callback knows which repo to connect
  const state = Buffer.from(JSON.stringify({ owner, repo, ts: Date.now() })).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: "repo",
    state,
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`,
  );
}
