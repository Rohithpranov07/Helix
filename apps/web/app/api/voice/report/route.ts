/**
 * T5.5 — Morning report voice briefing
 * POST { incidentId } → { text, audio: base64 | null }
 * Returns a spoken one-line report for a resolved incident.
 * audio is null when Sarvam TTS is unavailable; callers display text instead.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDb, findIncidentByIncidentId } from "@helix/db";
import { sarvam } from "@helix/ai";

const ReqSchema = z.object({ incidentId: z.string().min(1) });

function buildReport(incident: {
  incidentId: string;
  deployId: string;
  detectedAt: string;
  rollbackAt?: string;
  userImpactSeconds: number;
  causalChain: Array<{ description: string }>;
  antibodyId?: string;
  fixRef?: string;
}): string {
  const impactMin = Math.round(incident.userImpactSeconds / 60);
  const rootCause = incident.causalChain[0]?.description ?? "unknown cause";
  const rolledBack = incident.rollbackAt ? "rolled back and " : "";
  const healed = incident.fixRef ? "healed" : "under investigation";
  const ab = incident.antibodyId ? ` Antibody ${incident.antibodyId} minted.` : "";
  return (
    `Incident ${incident.incidentId} from deploy ${incident.deployId}: ` +
    `${impactMin} minute${impactMin === 1 ? "" : "s"} of user impact. ` +
    `Root cause: ${rootCause}. ` +
    `System ${rolledBack}${healed}.${ab}`
  );
}

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  await connectDb();
  const incident = await findIncidentByIncidentId(parsed.data.incidentId);
  if (!incident) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const text = buildReport(incident);

  // TTS via Bulbul — null on failure (text fallback)
  let audio: string | null = null;
  try {
    const buf = await sarvam.tts({ text });
    audio = buf.toString("base64");
  } catch {
    // voice unavailable — caller shows text
  }

  return NextResponse.json({ text, audio });
}
