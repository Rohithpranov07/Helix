import { NextResponse } from "next/server";
import { EntropyMeasureReqSchema } from "@helix/shared";
import { entropyMeasure } from "@helix/engine";

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = EntropyMeasureReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const result = await entropyMeasure(parsed.data);
  return NextResponse.json(result);
}
