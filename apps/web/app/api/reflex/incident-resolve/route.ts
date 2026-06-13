import { NextResponse } from "next/server";
import { z } from "zod";
import { incidentResolve } from "@helix/engine";

const ReqSchema = z.object({ incidentId: z.string().min(1) });

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const result = await incidentResolve(parsed.data);
  return NextResponse.json(result);
}
