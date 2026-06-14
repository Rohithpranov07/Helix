import { NextResponse } from "next/server";
import { MetabolismListReqSchema } from "@helix/shared";
import { metabolismList } from "@helix/engine";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = (url.searchParams.get("githubOwner") ?? url.searchParams.get("owner")) ?? undefined;
  const repo = (url.searchParams.get("githubRepo") ?? url.searchParams.get("repo")) ?? undefined;
  const statusParam = url.searchParams.get("status") ?? undefined;

  const parsed = MetabolismListReqSchema.safeParse({
    githubOwner: owner,
    githubRepo: repo,
    status: statusParam,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const result = await metabolismList(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
