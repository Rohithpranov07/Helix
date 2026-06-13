import { NextResponse } from "next/server";
import { IncidentHandleReqSchema } from "@helix/shared";
import { incidentHandle } from "@helix/engine";

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = IncidentHandleReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const result = await incidentHandle(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
