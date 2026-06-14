import { NextResponse } from "next/server";
import { railwayProjects } from "@helix/engine";

export async function GET() {
  try {
    const result = await railwayProjects({});
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
