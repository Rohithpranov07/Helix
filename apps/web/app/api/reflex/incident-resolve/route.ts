import { NextResponse } from "next/server";
import { IncidentResolveReqSchema } from "@helix/shared";
import { incidentResolve } from "@helix/engine";

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = IncidentResolveReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const result = await incidentResolve(parsed.data);
  return NextResponse.json(result);
}
