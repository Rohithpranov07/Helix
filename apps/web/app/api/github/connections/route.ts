import { NextResponse } from "next/server";
import { connectDb, listGitHubConnections } from "@helix/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDb();
    const connections = await listGitHubConnections();
    return NextResponse.json({ connections });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
