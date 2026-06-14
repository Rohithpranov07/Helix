import { NextResponse } from "next/server";
import { ImmuneListReqSchema } from "@helix/shared";
import { immuneList } from "@helix/engine";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const body = {
    githubOwner: (url.searchParams.get("githubOwner") ?? url.searchParams.get("owner")) ?? undefined,
    githubRepo: (url.searchParams.get("githubRepo") ?? url.searchParams.get("repo")) ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  };
  const parsed = ImmuneListReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const result = await immuneList(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
