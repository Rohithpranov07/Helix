/**
 * T5.5 — Voice follow-up (Saaras STT → Sarvam reason → Bulbul TTS)
 * POST { incidentId, audio: base64-wav } → { transcript, answer, audio: base64 | null }
 * audio is null when TTS is unavailable; caller shows answer text instead.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDb, findIncidentByIncidentId } from "@helix/db";
import { sarvam, reason } from "@helix/ai";
import { withRateLimit, LIMITS } from "@/lib/apiRateLimit";

const ReqSchema = z.object({
  incidentId: z.string().min(1),
  audio: z.string().min(1), // base64-encoded WAV
});

const handler = async (req: NextRequest) => {
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

  // STT — Saaras v3
  let transcript = "";
  try {
    const audioBuf = Buffer.from(parsed.data.audio, "base64");
    const result = await sarvam.stt({ audio: audioBuf, filename: "question.wav" });
    transcript = result.transcript;
  } catch {
    return NextResponse.json({ error: "STT_FAILED", transcript: "" }, { status: 502 });
  }

  // Reasoning — Sarvam answers the question from the incident record
  const incidentSummary = JSON.stringify({
    incidentId: incident.incidentId,
    deployId: incident.deployId,
    detectedAt: incident.detectedAt,
    rollbackAt: incident.rollbackAt,
    causalChain: incident.causalChain,
    userImpactSeconds: incident.userImpactSeconds,
    fixRef: incident.fixRef,
    antibodyId: incident.antibodyId,
  });

  let answer = "I don't have enough information to answer that.";
  try {
    const res = await reason({
      messages: [
        {
          role: "system",
          content:
            "You are HELIX, an autonomous software health system. Answer the operator's question " +
            "about the incident concisely in one or two sentences, using only the data provided. " +
            "Do not speculate beyond the record.",
        },
        {
          role: "user",
          content: `Incident record:\n${incidentSummary}\n\nQuestion: ${transcript}`,
        },
      ],
      temperature: 0.2,
    });
    answer = res.content.trim();
  } catch {
    answer = "Unable to retrieve answer — Sarvam unavailable.";
  }

  // TTS — Bulbul, text fallback on failure
  let audio: string | null = null;
  try {
    const buf = await sarvam.tts({ text: answer });
    audio = buf.toString("base64");
  } catch {
    // voice unavailable — caller shows text
  }

  return NextResponse.json({ transcript, answer, audio });
};

export const POST = withRateLimit(LIMITS.AI, handler);
