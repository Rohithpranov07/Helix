import { NextResponse } from "next/server";
import { ImmuneScanReqSchema } from "@helix/shared";
import { immuneScan } from "@helix/engine";

export const maxDuration = 300; // 5 minutes — scan fetches files + multiple AI calls

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = ImmuneScanReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const result = await immuneScan(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
