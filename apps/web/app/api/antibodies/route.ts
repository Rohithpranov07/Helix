import { NextResponse } from "next/server";
import { connectDb, listAntibodies } from "@helix/db";

export async function GET() {
  try {
    await connectDb();
    const antibodies = await listAntibodies();
    return NextResponse.json({
      antibodies: antibodies.map((a) => ({
        antibodyId: a.antibodyId,
        sourceType: a.sourceType,
        signature: a.signature,
        regressionTest: a.regressionTest,
        runtimeAssertion: a.runtimeAssertion,
        mintedAt: a.mintedAt,
        recurrencesBlocked: a.recurrencesBlocked,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "ANTIBODIES_ERROR", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
