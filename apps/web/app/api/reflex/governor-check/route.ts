import { NextResponse } from "next/server";
import { GovernorCheckReqSchema } from "@helix/shared";
import { governorCheck } from "@helix/engine";

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = GovernorCheckReqSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const result = await governorCheck(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
