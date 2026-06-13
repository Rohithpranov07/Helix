import { NextResponse } from "next/server";
import { GenomePairReqSchema } from "@helix/shared";
import { genomePair } from "@helix/engine";

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = GenomePairReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const result = await genomePair(parsed.data);
  return NextResponse.json(result);
}
