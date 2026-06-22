import { NextRequest, NextResponse } from "next/server";
import { ScanRunReqSchema } from "@helix/shared";
import { scanRun } from "@helix/engine";
import { withRateLimit, LIMITS } from "@/lib/apiRateLimit";

const handler = async (req: NextRequest) => {
  const body: unknown = await req.json().catch(() => null);
  const parsed = ScanRunReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const result = await scanRun(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
};

export const POST = withRateLimit(LIMITS.SCAN, handler);
