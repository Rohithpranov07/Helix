import { NextResponse } from "next/server";
import { connectDb, listDriftReports } from "@helix/db";
import type { DriftStatus } from "@helix/shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const owner = (searchParams.get("githubOwner") ?? searchParams.get("owner")) ?? undefined;
  const repo = (searchParams.get("githubRepo") ?? searchParams.get("repo")) ?? undefined;
  const status = searchParams.get("status") as DriftStatus | null;

  try {
    await connectDb();
    const reports = await listDriftReports({
      ...(owner ? { githubOwner: owner } : {}),
      ...(repo ? { githubRepo: repo } : {}),
      ...(status ? { status } : {}),
    });
    return NextResponse.json({ reports });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
