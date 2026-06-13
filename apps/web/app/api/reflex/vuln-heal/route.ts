import { NextResponse } from "next/server";
import { VulnHealReqSchema } from "@helix/shared";
import { vulnHeal } from "@helix/engine";

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = VulnHealReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const result = await vulnHeal(parsed.data);
  return NextResponse.json(result);
}
