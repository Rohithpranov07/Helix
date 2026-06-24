/**
 * T4.2 — Behaviour-equivalence verification
 *
 * verifyEquivalence(changeRef): given the patchRef produced by applyToShadow,
 *   1. Reads shadow/staging/<changeRef>/meta.json for vulnClass + endpoint.
 *   2. Builds class-specific HTTP traffic cases (attack + benign).
 *   3. Replays them against BOTH real target (:3001) and shadow (:3002).
 *   4. Groq (PRIMARY LLM) judges whether the attack is neutralised and
 *      counts regressions. Falls back to deterministic checks if Groq
 *      is unavailable.
 *   5. Persists a shadow_proof to MongoDB.
 *   6. Returns the proof (used by assertPromotable to gate real-target promotion).
 *
 * assertPromotable (re-exported from heal.ts for convenience): throws
 *   VerificationError unless proof.verdict === 'promote'.
 *
 * CLAUDE.md rule: Groq = behaviour-equivalence judgement. Gemini is never used here.
 */
import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { ValidationError, type ShadowProof, type ShadowVerdict, type VulnClass } from "@helix/shared";
import { groq } from "@helix/ai";
import { connectDb, createShadowProof } from "@helix/db";
import { replayTraffic, type TrafficCase, type TrafficReplay } from "./runtime.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(__dirname, "../../../..");
const SHADOW_STAGING = resolve(REPO_ROOT, "shadow/staging");

// ── Staging metadata ──────────────────────────────────────────────────────────

interface StagingMeta {
  findingId: string;
  vulnClass: VulnClass;
  endpoint: string;
}

const StagingMetaSchema = z.object({
  findingId: z.string().min(1),
  vulnClass: z.enum(["SQLi", "XSS", "missingRLS", "secretLeak", "authBypass"]),
  endpoint: z.string().min(1),
});

function readStagingMeta(changeRef: string): StagingMeta {
  const path = resolve(SHADOW_STAGING, changeRef, "meta.json");
  if (!existsSync(path)) {
    throw new ValidationError(
      `verifyEquivalence: staging meta not found for changeRef '${changeRef}'. ` +
        "Was applyInShadow called first?",
    );
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const parsed = StagingMetaSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(
      `verifyEquivalence: invalid staging meta for '${changeRef}'`,
      parsed.error,
    );
  }
  return parsed.data;
}

// ── Traffic case building ─────────────────────────────────────────────────────

function buildTrafficCases(vulnClass: VulnClass, endpoint: string): TrafficCase[] {
  switch (vulnClass) {
    case "SQLi":
      return [
        // Attack: SQL tautology — should return ≤ benign row count after fix
        { method: "GET", path: `${endpoint}?q=%27+OR+%271%27%3D%271` },
        // Benign: normal query
        { method: "GET", path: `${endpoint}?q=helix_nomatch_xyz` },
      ];
    case "XSS":
      return [
        // Attack: script injection — should not be reflected verbatim after fix
        { method: "GET", path: `${endpoint}?q=%3Cscript%3Ealert%281%29%3C%2Fscript%3E` },
        // Benign: normal query
        { method: "GET", path: `${endpoint}?q=normal+search` },
      ];
    case "secretLeak":
      return [
        // Load a page that triggers bundle fetching — secret must not appear
        { method: "GET", path: "/search" },
        { method: "GET", path: "/" },
      ];
    case "authBypass":
      return [
        // Unauthenticated request to protected endpoint — must return 401/403 after fix
        { method: "GET", path: endpoint },
      ];
    case "missingRLS":
      return [
        // Unauthenticated request — must return 401/403 or single-user data after fix
        { method: "GET", path: endpoint },
        { method: "GET", path: "/" },
      ];
  }
}

// ── Groq equivalence judgement ──────────────────────────────────────────────

const JudgeOutputSchema = z.object({
  intendedFixPassed: z.boolean(),
  regressions: z.number().int().min(0),
  rationale: z.string(),
});

type JudgeOutput = z.infer<typeof JudgeOutputSchema>;

const JUDGE_SYSTEM = [
  "You are HELIX's behaviour-equivalence judge for the ShopLite demo app.",
  "You receive a vulnerability class, the targeted endpoint, and HTTP response pairs",
  "from the REAL target (before fix, port 3001) and the SHADOW twin (after patch, port 3002).",
  "Decide:",
  "  intendedFixPassed: true if the attack case is neutralised on the shadow",
  "    (e.g. SQLi tautology no longer returns all rows; XSS payload is not reflected",
  "    verbatim; authBypass returns 401/403; secretLeak response has no service key).",
  "  regressions: count of cases where the real target returned 2xx but shadow returned 5xx.",
  "Respond ONLY with a JSON object: { intendedFixPassed: boolean, regressions: number, rationale: string }.",
].join(" ");

function buildJudgePrompt(
  meta: StagingMeta,
  replays: TrafficReplay[],
): string {
  const lines: string[] = [
    `Vulnerability class: ${meta.vulnClass}`,
    `Endpoint: ${meta.endpoint}`,
    "",
    "Traffic replay results (real=baseline, shadow=patched):",
  ];
  for (const r of replays) {
    lines.push(`  ${r.case.method} ${r.case.path}`);
    lines.push(`    real:   status=${r.real.status} body=${r.real.body.slice(0, 200)}`);
    lines.push(`    shadow: status=${r.shadow.status} body=${r.shadow.body.slice(0, 200)}`);
  }
  return lines.join("\n");
}

async function groqJudge(
  meta: StagingMeta,
  replays: TrafficReplay[],
): Promise<JudgeOutput> {
  const result = await groq.chat({
    messages: [
      { role: "system", content: JUDGE_SYSTEM },
      { role: "user", content: buildJudgePrompt(meta, replays) },
    ],
    schema: JudgeOutputSchema,
    temperature: 0.1,
  });
  return JudgeOutputSchema.parse(JSON.parse(result.content));
}

// ── Deterministic fallback ────────────────────────────────────────────────────

function deterministicJudge(
  vulnClass: VulnClass,
  replays: TrafficReplay[],
): JudgeOutput {
  const attackReplay = replays[0];
  if (!attackReplay) {
    return { intendedFixPassed: false, regressions: 0, rationale: "No traffic cases to evaluate." };
  }

  let intendedFixPassed = false;
  const shadowStatus = attackReplay.shadow.status;
  const shadowBody = attackReplay.shadow.body;

  switch (vulnClass) {
    case "SQLi": {
      // Fix: tautology returns ≤ benign-sized response, or shadow returns 4xx
      if (shadowStatus >= 400 || shadowStatus === 0) {
        intendedFixPassed = true;
      } else {
        const benign = replays[1];
        intendedFixPassed = benign
          ? shadowBody.length <= benign.shadow.body.length + 50
          : shadowBody.length < 300;
      }
      break;
    }
    case "XSS": {
      // Fix: raw <script> tag not in shadow response body
      intendedFixPassed = !shadowBody.includes("<script>alert(1)</script>");
      break;
    }
    case "secretLeak": {
      // Fix: no service_role key in any shadow response
      intendedFixPassed = !replays.some((r) => r.shadow.body.includes("service_role"));
      break;
    }
    case "authBypass": {
      // Fix: shadow returns 401, 403, or 302 instead of 200
      intendedFixPassed =
        shadowStatus === 401 || shadowStatus === 403 || shadowStatus === 302;
      break;
    }
    case "missingRLS": {
      // Fix: shadow returns 401/403, OR body has < 2 distinct UUIDs (single user's data)
      if (shadowStatus === 401 || shadowStatus === 403) {
        intendedFixPassed = true;
      } else {
        const uuids = new Set(
          shadowBody.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? [],
        );
        intendedFixPassed = uuids.size < 2;
      }
      break;
    }
  }

  let regressions = 0;
  for (const r of replays) {
    if (r.real.status >= 200 && r.real.status < 300 && r.shadow.status >= 500) {
      regressions++;
    }
  }

  return {
    intendedFixPassed,
    regressions,
    rationale: `Deterministic fallback for ${vulnClass}: intendedFixPassed=${String(intendedFixPassed)}, regressions=${regressions}.`,
  };
}

// ── verifyEquivalence ─────────────────────────────────────────────────────────

/**
 * Verifies that a Shadow twin patch correctly fixes the vulnerability without
 * regressions. Returns a persisted shadow_proof.
 *
 * Implements the EquivalenceVerifier seam expected by healVulnerability.
 * Wire as: `verify: (changeRef) => verifyEquivalence(changeRef)` in HealDeps.
 */
export async function verifyEquivalence(
  changeRef: string,
  opts: { targetUrl?: string; shadowUrl?: string } = {},
): Promise<ShadowProof> {
  await connectDb();

  // 1. Discover what was patched.
  const meta = readStagingMeta(changeRef);

  // 2. Build and replay traffic cases.
  const cases = buildTrafficCases(meta.vulnClass, meta.endpoint);
  const replays = await replayTraffic(cases, opts);

  // 3. Ask Groq to judge equivalence; fall back to deterministic checks.
  let judgement: JudgeOutput;
  try {
    judgement = await groqJudge(meta, replays);
  } catch {
    judgement = deterministicJudge(meta.vulnClass, replays);
  }

  // 4. Compute verdict.
  const verdict: ShadowVerdict =
    judgement.intendedFixPassed && judgement.regressions === 0 ? "promote" : "reject";

  // 5. Persist the proof.
  const proof: ShadowProof = {
    proofId: `proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    changeRef,
    replayedCases: replays.length,
    intendedFixPassed: judgement.intendedFixPassed,
    regressions: judgement.regressions,
    verdict,
    verifiedAt: new Date().toISOString(),
  };

  const doc = await createShadowProof(proof);
  return doc;
}
