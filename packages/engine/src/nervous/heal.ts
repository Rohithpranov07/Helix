/**
 * T5.4 — Reproduce → fix → verify → promote → immunise
 *
 * healIncident: given an incident with a causal chain + failing request, HELIX
 *   autonomously closes the loop:
 *
 *   1. Groq (PRIMARY LLM) infers the vulnerability class from the causal chain
 *      and synthesizes a minimal unified-diff fix targeted at ShopLite.
 *   2. Applies the patch to the Shadow twin (never the real target).
 *   3. verifyEquivalence proves the failing case now passes, zero regressions.
 *   4. assertPromotable: if verdict ≠ 'promote', escalate to human review —
 *      the real target is NEVER touched without a promote verdict.
 *   5. Promotes the Shadow-proven patch to the real apps/target/ source tree.
 *   6. Mints an antibody so this class of failure cannot recur.
 *   7. Updates the incident record: fixRef, shadowProof, antibodyId.
 *
 * THE SHADOW INVARIANT IS INVIOLABLE: promote is only called after assertPromotable
 * passes on a stored shadow_proof. All four action seams default to NOT_WIRED stubs
 * so this module is safe to import before Shadow is available.
 *
 * Wire: `incidentHandle` in index.ts calls healIncident automatically when the
 * incident's rollbackAt field is set (i.e. Groq recommended rollback).
 */
import { z } from "zod";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import {
  ValidationError,
  VerificationError,
  type Incident,
  type VulnClass,
  type ShadowProof,
} from "@helix/shared";
import { groq } from "@helix/ai";
import { connectDb, updateIncident } from "@helix/db";
import type { HelixDoc } from "@helix/db";
import { assertPatchSafe, type Patch, type ShadowApplyResult } from "../immune/patch.js";
import { assertPromotable } from "../immune/heal.js";
import { extractEndpoint } from "./resolve.js";

// ── Constants ─────────────────────────────────────────────────────────────────

// packages/engine/src/nervous/ → 4 levels up = repo root
const REPO_ROOT = resolve(__dirname, "../../../../");
const SHADOW_STAGING = resolve(REPO_ROOT, "shadow/staging");

// ── Incident patch synthesis (Groq) ─────────────────────────────────────────

/** Internal synthesis result — patch + metadata needed to write staging meta.json. */
export interface IncidentSynthResult {
  patch: Patch;
  inferredClass: VulnClass;
  endpoint: string;
}

const IncidentSynthOutputSchema = z.object({
  inferredClass: z.enum(["SQLi", "XSS", "authBypass", "secretLeak", "missingRLS"]),
  files: z
    .array(z.object({ path: z.string().min(1), diff: z.string().min(1) }))
    .min(1),
  rationale: z.string().min(1),
});

const INCIDENT_SYNTH_SYSTEM = [
  "You are HELIX's Nervous System patch synthesizer for the demo app 'ShopLite'.",
  "Given an incident's causal chain and failing request, infer the vulnerability",
  "class and produce the MINIMAL code fix.",
  "Known classes and their fix targets:",
  "  SQLi → apps/target/src/app/api/products/search/route.ts",
  "    (replace string-concatenated SQL with parameterized queries)",
  "  XSS → apps/target/src/app/search/page.tsx",
  "    (remove dangerouslySetInnerHTML; render as escaped text)",
  "  authBypass → apps/target/src/app/admin/orders/page.tsx",
  "    (add server-side auth/authorization check before returning data)",
  "  secretLeak → apps/target/src/lib/adminClient.ts",
  "    (move service key to server-only route; never in browser bundle)",
  "  missingRLS → apps/target/supabase/migrations/002_orders_rls.sql",
  "    (ENABLE ROW LEVEL SECURITY; policy restricts SELECT to auth.uid() match)",
  "Every file path in your output MUST start with 'apps/target/'.",
  "Respond ONLY with JSON:",
  '{ "inferredClass": string, "files": [{ "path": string, "diff": string }], "rationale": string }',
].join(" ");

function buildSynthPrompt(incident: HelixDoc<Incident>): string {
  const chainText = incident.causalChain
    .map((s) => `  ${s.order}. ${s.description} (evidence: ${s.evidenceRef})`)
    .join("\n");

  const signalText =
    typeof incident.failingRequest === "object" && incident.failingRequest !== null
      ? JSON.stringify(incident.failingRequest).slice(0, 800)
      : String(incident.failingRequest).slice(0, 800);

  return [
    `Incident: ${incident.incidentId}`,
    `Deploy:   ${incident.deployId}`,
    `Baseline delta: ${incident.baselineDelta}ms`,
    "",
    "Causal chain:",
    chainText,
    "",
    "Failing request (raw signal):",
    signalText,
    "",
    "Infer the vulnerability class. Generate the minimal unified diff to fix it.",
    "Touch only files under apps/target/.",
  ].join("\n");
}

/**
 * Groq synthesizes a targeted fix from the incident's causal chain.
 * Returns the patch plus the inferred class + endpoint for staging meta.json.
 */
export async function synthesizeIncidentPatch(
  incident: HelixDoc<Incident>,
): Promise<IncidentSynthResult> {
  const result = await groq.chat({
    messages: [
      { role: "system", content: INCIDENT_SYNTH_SYSTEM },
      { role: "user", content: buildSynthPrompt(incident) },
    ],
    schema: IncidentSynthOutputSchema,
    temperature: 0.1,
  });

  const out = IncidentSynthOutputSchema.parse(JSON.parse(result.content));
  const patch: Patch = { files: out.files, rationale: out.rationale };

  // Hard safety boundary — rejects patches outside apps/target/.
  assertPatchSafe(patch);

  const endpoint =
    extractEndpoint(incident.failingRequest) ??
    `/${out.inferredClass.toLowerCase()}`;

  return { patch, inferredClass: out.inferredClass, endpoint };
}

// ── Seam contracts ────────────────────────────────────────────────────────────

export interface HealIncidentDeps {
  synthesize?: (incident: HelixDoc<Incident>) => Promise<IncidentSynthResult>;
  applyShadow?: (patch: Patch) => Promise<ShadowApplyResult>;
  verify?: (changeRef: string) => Promise<ShadowProof>;
  promote?: (patch: Patch) => Promise<void>;
  mint?: (incidentId: string) => Promise<string>;
  maxAttempts?: number;
  onEvent?: (event: HealIncidentEvent) => void | Promise<void>;
}

export type HealIncidentOutcome = "healed" | "escalated";

export interface HealIncidentEvent {
  incidentId: string;
  outcome: HealIncidentOutcome;
  detail: string;
  patchRef?: string;
  proofId?: string;
  antibodyId?: string;
  at: string;
}

export interface HealIncidentResult {
  incident: HelixDoc<Incident>;
  outcome: HealIncidentOutcome;
  antibodyId?: string;
  proof?: ShadowProof;
  escalationReason?: string;
}

const NOT_WIRED = (name: string, task: string): never => {
  throw new ValidationError(
    `${name} is not wired (${task} not yet built). ` +
      `healIncident requires it via HealIncidentDeps; it will NEVER promote ` +
      `without a verdict:'promote' shadow_proof.`,
  );
};

// ── healIncident ──────────────────────────────────────────────────────────────

/**
 * Autonomously heals an incident end-to-end through the Shadow.
 *
 * Promotes to the real target ONLY after assertPromotable passes on a stored
 * shadow_proof with verdict:'promote'. On escalation the target is left untouched.
 */
export async function healIncident(
  incident: HelixDoc<Incident>,
  deps: HealIncidentDeps = {},
): Promise<HealIncidentResult> {
  await connectDb();

  const {
    synthesize = synthesizeIncidentPatch,
    applyShadow = () => NOT_WIRED("applyShadow", "T4.1"),
    verify = () => NOT_WIRED("verifyEquivalence", "T4.2"),
    promote = () => NOT_WIRED("promote", "T5.2"),
    mint = () => NOT_WIRED("mintAntibody", "T3.1"),
    maxAttempts = 2,
    onEvent = defaultOnEvent,
  } = deps;

  const emit = (
    outcome: HealIncidentOutcome,
    detail: string,
    extra: Partial<HealIncidentEvent> = {},
  ): Promise<void> | void =>
    onEvent({
      incidentId: incident.incidentId,
      outcome,
      detail,
      at: new Date().toISOString(),
      ...extra,
    });

  let lastProof: ShadowProof | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // 1. Groq synthesizes a targeted patch from the causal chain + failing request.
    const { patch, inferredClass, endpoint } = await synthesize(incident);

    // 2. Apply to Shadow only — never the real target.
    const applied = await applyShadow(patch);

    // 3. Write meta.json so verifyEquivalence can resolve class + endpoint from patchRef.
    //    Uses the same schema as applyInShadow (T2.3). incident._id serves as findingId.
    const metaDir = resolve(SHADOW_STAGING, applied.patchRef);
    mkdirSync(metaDir, { recursive: true });
    writeFileSync(
      resolve(metaDir, "meta.json"),
      JSON.stringify({ findingId: incident._id, vulnClass: inferredClass, endpoint }),
      "utf8",
    );

    // 4. Behaviour-equivalence proof — the failing case must now pass with zero regressions.
    const proof = await verify(applied.patchRef);
    lastProof = proof;

    // 5. PROMOTION GATE — assertPromotable throws VerificationError when verdict ≠ 'promote'.
    try {
      assertPromotable(proof);
    } catch (err) {
      if (err instanceof VerificationError) {
        await emit(
          "escalated",
          `Equivalence verdict '${proof.verdict}' — escalating to human review. ` +
            `Real target untouched.`,
          { patchRef: applied.patchRef, proofId: proof.proofId },
        );
        if (attempt < maxAttempts) continue; // retry synthesis
        // Exhausted attempts — persist proofId so operator can inspect.
        const updated =
          (await updateIncident(incident._id, { shadowProof: proof.proofId })) ??
          incident;
        return {
          incident: updated,
          outcome: "escalated",
          proof,
          escalationReason: `No promotable patch after ${maxAttempts} attempt(s). Verdict: ${proof.verdict}`,
        };
      }
      throw err;
    }

    // 6. Promote the proven patch to the real apps/target/ source tree.
    await promote(patch);

    // 7. Mint antibody — this incident class cannot recur without triggering a match.
    const antibodyId = await mint(incident._id);

    // 8. Persist fix metadata on the incident record.
    const updatedIncident =
      (await updateIncident(incident._id, {
        fixRef: applied.patchRef,
        shadowProof: proof.proofId,
        antibodyId,
      })) ?? incident;

    await emit("healed", `Fix promoted and immunised. antibody:${antibodyId}`, {
      patchRef: applied.patchRef,
      proofId: proof.proofId,
      antibodyId,
    });

    return { incident: updatedIncident, outcome: "healed", antibodyId, proof };
  }

  // Unreachable — every loop iteration returns or continues.
  return {
    incident,
    outcome: "escalated",
    ...(lastProof ? { proof: lastProof } : {}),
    escalationReason: `Synthesis exhausted ${maxAttempts} attempts without a promote verdict.`,
  };
}

function defaultOnEvent(event: HealIncidentEvent): void {
  // eslint-disable-next-line no-console
  console.log("[healIncident]", JSON.stringify(event));
}
