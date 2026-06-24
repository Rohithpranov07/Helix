/**
 * T5.1 — Resurrection Reflex (Nervous System)
 *
 * handleIncident: when production fails after a deploy, HELIX's Nervous System
 *   fires to reconstruct WHY. It:
 *
 *   1. Parses the raw production signal (permissive Zod, accepts any shape).
 *   2. If the signal contains long log or HTML text, uses Gemini for structured
 *      extraction (CLAUDE.md: "log/UI parsing for Resurrection Reflex").
 *      Gemini is used HERE and ONLY here — no reasoning, no patches.
 *   3. Uses Groq (PRIMARY LLM) to reconstruct the causal chain (3–5 steps)
 *      and estimate rollbackRecommended + userImpactSeconds.
 *   4. Computes baselineDelta from latency or infers from HTTP status.
 *   5. Persists the incident to MongoDB, returns the document.
 *
 * The causal chain is the key output — it tells the operator exactly why the
 * deploy failed, linking each step to evidence from the signal.
 */
import { z } from "zod";
import { groq, gemini } from "@helix/ai";
import { type Incident, type CausalStep } from "@helix/shared";
import { connectDb, createIncident } from "@helix/db";
import type { HelixDoc } from "@helix/db";
import type { IncidentHandleReq } from "@helix/shared";

// ── Production signal parsing ─────────────────────────────────────────────────

/**
 * Permissive schema — the production signal can come from any monitoring system
 * (PagerDuty, Sentry, custom webhook, n8n). We accept any shape and extract
 * known fields when present.
 */
const ProductionSignalSchema = z
  .object({
    url: z.string().optional(),
    method: z.string().optional(),
    status: z.number().optional(),
    latencyMs: z.number().optional(),
    baselineLatencyMs: z.number().optional(),
    error: z.string().optional(),
    log: z.string().optional(),
    html: z.string().optional(),
    message: z.string().optional(),
    payload: z.unknown().optional(),
  })
  .passthrough();

type ParsedSignal = z.infer<typeof ProductionSignalSchema>;

function parseSignal(raw: unknown): ParsedSignal {
  if (typeof raw === "string") {
    // Raw string signal (log dump or error message)
    return { error: raw.slice(0, 2000) };
  }
  const result = ProductionSignalSchema.safeParse(raw);
  return result.success ? result.data : { error: JSON.stringify(raw).slice(0, 2000) };
}

// ── baselineDelta computation ─────────────────────────────────────────────────

function computeBaselineDelta(signal: ParsedSignal): number {
  if (signal.latencyMs !== undefined && signal.baselineLatencyMs !== undefined) {
    return signal.latencyMs - signal.baselineLatencyMs;
  }
  if (signal.latencyMs !== undefined) {
    // No baseline provided — infer from typical ShopLite p50 (~150ms)
    return Math.max(0, signal.latencyMs - 150);
  }
  if (signal.status !== undefined && signal.status >= 500) {
    // HTTP 5xx: treat as severe degradation (5000ms equivalent)
    return 5000;
  }
  return 0;
}

// ── Gemini log/UI parsing (LOW SURFACE AREA — only for raw text signals) ──────

/**
 * If the signal contains a long log string or HTML dump, ask Gemini to extract
 * a concise structured summary. This is the ONLY permitted Gemini use in the
 * Nervous System (CLAUDE.md: "log/UI parsing for Resurrection Reflex").
 *
 * Returns null when Gemini is unavailable or the signal has no text content.
 */
async function geminiParseSignal(
  signal: ParsedSignal,
): Promise<string | null> {
  const rawText = signal.log ?? signal.html ?? signal.error ?? "";
  if (rawText.length < 300) return null; // not worth a Gemini call

  try {
    const result = await gemini.analyze({
      parts: [{ text: rawText.slice(0, 8000) }],
      systemPrompt:
        "You are a log parser. Extract a concise (≤200 word) structured summary " +
        "of this production log or HTML output. Include: error type, affected endpoints, " +
        "stack trace highlights. Plain text only.",
    });
    return result.content.slice(0, 500);
  } catch {
    return null;
  }
}

// ── Groq causal chain reconstruction ───────────────────────────────────────

const CausalOutputSchema = z.object({
  causalChain: z
    .array(
      z.object({
        order: z.number().int().min(1),
        description: z.string().min(5),
        evidenceRef: z.string().min(1),
      }),
    )
    .min(1)
    .max(5),
  rollbackRecommended: z.boolean(),
  userImpactSeconds: z.number().int().min(0),
});

type CausalOutput = z.infer<typeof CausalOutputSchema>;

const CAUSAL_SYSTEM = [
  "You are HELIX's Nervous System (Resurrection Reflex) for the ShopLite demo app.",
  "Given a production deployment signal, reconstruct the causal chain of failure",
  "in 3–5 ordered steps. For each step provide:",
  "  order: step number (1-based)",
  "  description: what happened at this step",
  "  evidenceRef: which part of the signal is evidence (e.g. 'status:500', 'log line 3', 'latencyMs')",
  "Also decide: rollbackRecommended (true if service is critically degraded or data is at risk),",
  "  userImpactSeconds (estimate of how long users were/will be impacted: 0–3600).",
  "Respond ONLY with JSON: { causalChain: [...], rollbackRecommended: boolean, userImpactSeconds: number }",
].join(" ");

function buildCausalPrompt(
  deployId: string,
  signal: ParsedSignal,
  parsedLog: string | null,
): string {
  const lines: string[] = [
    `Deploy ID: ${deployId}`,
    `Signal summary:`,
    `  URL: ${signal.url ?? "unknown"}`,
    `  Method: ${signal.method ?? "unknown"}`,
    `  HTTP status: ${signal.status ?? "unknown"}`,
    `  Latency: ${signal.latencyMs !== undefined ? `${signal.latencyMs}ms` : "unknown"}`,
    `  Baseline latency: ${signal.baselineLatencyMs !== undefined ? `${signal.baselineLatencyMs}ms` : "~150ms"}`,
    `  Error: ${signal.error ?? "none"}`,
    `  Message: ${signal.message ?? "none"}`,
  ];
  if (parsedLog) {
    lines.push(``, `Parsed log summary (Gemini-extracted):`, parsedLog);
  }
  lines.push(``, `Reconstruct the causal chain for this incident.`);
  return lines.join("\n");
}

async function groqCausalChain(
  deployId: string,
  signal: ParsedSignal,
  parsedLog: string | null,
): Promise<CausalOutput> {
  const result = await groq.chat({
    messages: [
      { role: "system", content: CAUSAL_SYSTEM },
      { role: "user", content: buildCausalPrompt(deployId, signal, parsedLog) },
    ],
    schema: CausalOutputSchema,
    temperature: 0.2,
  });
  return CausalOutputSchema.parse(JSON.parse(result.content));
}

// ── Deterministic fallback ────────────────────────────────────────────────────

function deterministicCausal(
  deployId: string,
  signal: ParsedSignal,
  baselineDelta: number,
): CausalOutput {
  const steps: CausalStep[] = [];

  if (signal.status !== undefined && signal.status >= 500) {
    steps.push(
      { order: 1, description: `Deploy ${deployId} introduced a change that caused HTTP ${signal.status} responses.`, evidenceRef: `status:${signal.status}` },
      { order: 2, description: "Application process crashed or threw an unhandled exception on the affected endpoint.", evidenceRef: signal.url ? `url:${signal.url}` : "signal.url" },
      { order: 3, description: "Requests started failing; users received error responses instead of expected content.", evidenceRef: "HTTP 5xx response chain" },
    );
  } else if (baselineDelta > 1000) {
    steps.push(
      { order: 1, description: `Deploy ${deployId} increased p50 latency by ${baselineDelta}ms above baseline.`, evidenceRef: `latencyMs:${signal.latencyMs ?? "unknown"}` },
      { order: 2, description: "Slow database query or blocking I/O introduced in the new code path.", evidenceRef: "latency spike" },
      { order: 3, description: "User-facing requests timed out or received degraded responses.", evidenceRef: `baselineDelta:${baselineDelta}ms` },
    );
  } else if (signal.error) {
    steps.push(
      { order: 1, description: `An error was recorded: ${signal.error.slice(0, 80)}`, evidenceRef: "signal.error" },
      { order: 2, description: `Deploy ${deployId} likely introduced a code path that triggers this error.`, evidenceRef: `deployId:${deployId}` },
      { order: 3, description: "Affected users may have experienced partial functionality loss.", evidenceRef: "signal.error" },
    );
  } else {
    steps.push(
      { order: 1, description: `Production signal received after deploy ${deployId}.`, evidenceRef: "signal" },
      { order: 2, description: "Automatic causal analysis unavailable — Groq offline. Manual investigation required.", evidenceRef: "groq_unavailable" },
    );
  }

  const rollbackRecommended =
    (signal.status !== undefined && signal.status >= 500) || baselineDelta > 3000;

  return {
    causalChain: steps,
    rollbackRecommended,
    userImpactSeconds: rollbackRecommended ? 120 : Math.min(Math.ceil(baselineDelta / 100), 60),
  };
}

// ── handleIncident ────────────────────────────────────────────────────────────

/**
 * Resurrection Reflex entry point. Wire this to the `incidentHandle` reflex in
 * `packages/engine/src/index.ts`. The n8n nervous.json workflow calls
 * POST /api/reflex/incident-handle when a deploy signal arrives.
 */
export async function handleIncident(
  req: IncidentHandleReq,
): Promise<HelixDoc<Incident>> {
  await connectDb();

  const signal = parseSignal(req.signal);
  const baselineDelta = computeBaselineDelta(signal);

  // Gemini: parse long log/HTML text if present (LOW SURFACE AREA per CLAUDE.md).
  const parsedLog = await geminiParseSignal(signal);

  // Groq: reconstruct the causal chain.
  let causalOutput: CausalOutput;
  try {
    causalOutput = await groqCausalChain(req.deployId, signal, parsedLog);
  } catch {
    causalOutput = deterministicCausal(req.deployId, signal, baselineDelta);
  }

  const incident: Incident = {
    incidentId: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    deployId: req.deployId,
    detectedAt: new Date().toISOString(),
    baselineDelta,
    causalChain: causalOutput.causalChain,
    failingRequest: req.signal,
    userImpactSeconds: causalOutput.userImpactSeconds,
  };

  // Add optional rollback timestamp if Groq recommends it.
  if (causalOutput.rollbackRecommended) {
    incident.rollbackAt = new Date().toISOString();
  }

  const doc = await createIncident(incident);

  // eslint-disable-next-line no-console
  console.log(
    `[incident] ${doc.incidentId} | deploy:${req.deployId} | delta:${baselineDelta}ms | ` +
      `steps:${causalOutput.causalChain.length} | rollback:${String(causalOutput.rollbackRecommended)}`,
  );

  return doc;
}
