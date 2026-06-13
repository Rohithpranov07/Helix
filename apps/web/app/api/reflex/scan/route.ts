import { NextResponse } from "next/server";
import { ScanRunReqSchema } from "@helix/shared";
import { scanRun } from "@helix/engine";

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = ScanRunReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const result = await scanRun(parsed.data);
  return NextResponse.json(result);
}
