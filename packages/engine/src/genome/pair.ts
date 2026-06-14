/**
 * T6.2 — Base-pairing + drift detection (Genome organ)
 *
 * pairGenome(moduleId, deps?):
 *   1. Gemini reads live source + intent strand invariants (wide-context per CLAUDE.md).
 *   2. Computes pairing.score + unpairedInvariants, flags code-drift and intent-drift.
 *   3. Sarvam explains each mismatch and proposes a minimal correction.
 *   4. The correction is routed through verifyCorrection (the Shadow gate) before
 *      being marked promotable. No correction can reach the real target without a
 *      shadow_proof with verdict:'promote'. This is the Shadow invariant applied to
 *      the Genome organ — identical to how healVulnerability gates on verdict:'promote'.
 *   5. Persists updated pairing to MongoDB.
 *
 * Shadow gate:
 *   verifyCorrection is an injectable dep. When not wired, NOT_WIRED_VERIFY_CORRECTION
 *   throws ValidationError — any auto-promotion attempt fails immediately. When wired
 *   (in index.ts), it runs applyToShadow → verifyEquivalence and returns the proof.
 *   pairGenome attaches proof + promotable to each CorrectionProposal so callers can
 *   see which corrections passed Shadow verification without triggering promotion.
 */
import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { ValidationError, type IntentStrand, type ShadowProof, type VulnClass } from "@helix/shared";
import { gemini, sarvam } from "@helix/ai";
import { connectDb, listIntentStrands, updateIntentStrand, findGitHubConnection } from "@helix/db";
import type { HelixDoc } from "@helix/db";
import { getRepoTree, readFile as ghReadFile } from "./github.js";

// packages/engine/src/genome/ → 4 levels up = repo root
const REPO_ROOT = resolve(__dirname, "../../../../");

// ── Gemini pairing output schema ──────────────────────────────────────────────

const GeminiPairOutputSchema = z.object({
  pairedInvariants: z.array(z.string()),
  unpairedInvariants: z.array(
    z.object({
      id: z.string().min(1),
      type: z.enum(["code-drift", "intent-drift"]),
      evidenceRef: z.string().min(1),
    }),
  ),
  score: z.number().min(0).max(1),
  rationale: z.string().min(5),
});

type GeminiPairOutput = z.infer<typeof GeminiPairOutputSchema>;

// ── Sarvam correction schema ───────────────────────────────────────────────────

const SarvamCorrectionSchema = z.object({
  explanation: z.string().min(10),
  suggestedPatch: z.string().min(5),
});

// ── Public types ───────────────────────────────────────────────────────────────

export interface PairMismatch {
  invariantId: string;
  type: "code-drift" | "intent-drift";
  description: string;
  evidenceRef: string;
}

/**
 * A correction proposal with:
 *   - invariantRule / invariantCompliance: carried so the Shadow routing can
 *     infer the appropriate vulnClass for traffic case generation.
 *   - proof / promotable: populated by pairGenome when verifyCorrection is wired.
 *     When NOT_WIRED, promotable is false and proof is absent.
 */
export interface CorrectionProposal {
  invariantId: string;
  invariantRule: string;
  invariantCompliance: boolean;
  explanation: string;
  suggestedPatch: string;
  requiresShadowVerification: true;
  proof?: ShadowProof;
  promotable?: boolean;
}

export interface PairGenomeResult {
  strand: HelixDoc<IntentStrand>;
  score: number;
  mismatches: PairMismatch[];
  corrections: CorrectionProposal[];
}

export interface PairGenomeDeps {
  analyze?: (
    code: string,
    invariants: IntentStrand["invariants"],
  ) => Promise<GeminiPairOutput>;
  explain?: (
    mismatch: PairMismatch,
    code: string,
  ) => Promise<{ explanation: string; suggestedPatch: string }>;
  /**
   * Shadow gate for correction proposals. Returns a ShadowProof.
   *
   * WHEN NOT WIRED: NOT_WIRED_VERIFY_CORRECTION throws ValidationError — any
   * attempt to promote a correction without Shadow verification fails immediately.
   *
   * WHEN WIRED (index.ts genomePair): applies the suggestedPatch to the Shadow
   * twin, runs verifyEquivalence, and returns the proof. pairGenome attaches the
   * proof to the CorrectionProposal and sets promotable = (verdict === 'promote').
   *
   * Per the Shadow invariant: no correction reaches the real target without a
   * shadow_proof with verdict:'promote'.
   */
  verifyCorrection?: (proposal: CorrectionProposal) => Promise<ShadowProof>;
}

// ── Shadow gate helpers ───────────────────────────────────────────────────────

/**
 * NOT_WIRED Shadow gate — exported so callers can explicitly test the gate or
 * pass it as the dep when they want hard enforcement with no wiring.
 * Throws ValidationError immediately — any promotion attempt fails.
 */
export const NOT_WIRED_VERIFY_CORRECTION: Required<PairGenomeDeps>["verifyCorrection"] =
  async (_proposal: CorrectionProposal): Promise<ShadowProof> => {
    throw new ValidationError(
      "verifyCorrection is NOT_WIRED — wire to verifyEquivalence before promoting any " +
        "genome correction to target. Per the Shadow invariant no write may reach the " +
        "real target without a shadow_proof with verdict:'promote'.",
    );
  };

/**
 * Infers the most likely VulnClass for traffic-case generation when verifying a
 * Genome correction. Used by the wired verifyCorrection dep in index.ts.
 *
 * The mapping is approximate but correct for the five ShopLite demo classes:
 *   SQLi → query/parameterize invariants
 *   XSS → rendering/script/escape invariants
 *   missingRLS → row-level / user isolation invariants
 *   secretLeak → service key / credential invariants
 *   authBypass → everything else, especially compliance authorization invariants
 */
export function inferVulnClassFromInvariant(
  rule: string,
  _compliance: boolean,
): VulnClass {
  const r = rule.toLowerCase();
  if (r.includes("sql") || r.includes("inject") || r.includes("parameteriz")) return "SQLi";
  if (r.includes("script") || r.includes("xss") || r.includes("html") || r.includes("escap")) return "XSS";
  if (r.includes("rls") || r.includes("row level") || r.includes("user_id") || r.includes("isolation")) return "missingRLS";
  if (r.includes("secret") || r.includes("service_role") || r.includes("credential") || r.includes("api key")) return "secretLeak";
  return "authBypass";
}

/**
 * Parses the target file path from a unified diff header.
 * Accepts both `+++ b/<path>` and `--- a/<path>` forms.
 * Returns null when no recognisable header is found.
 */
export function parsePatchFilePath(suggestedPatch: string): string | null {
  const plusMatch = suggestedPatch.match(/^\+\+\+ b\/(.+)$/m);
  if (plusMatch?.[1]) return plusMatch[1].trim();
  const minusMatch = suggestedPatch.match(/^--- a\/(.+)$/m);
  if (minusMatch?.[1]) return minusMatch[1].trim();
  return null;
}

// ── Gemini base-pair analysis ─────────────────────────────────────────────────

const GEMINI_SYSTEM = [
  "You are HELIX's Genome organ performing base-pair analysis.",
  "Given a module's source code and its intent strand invariants, determine which invariants",
  "are implemented (or enforced) in the code and which are not.",
  "",
  "For each unpaired invariant choose the type:",
  "  code-drift: the invariant exists in intent but the code does NOT implement or enforce it.",
  "  intent-drift: the invariant was added to intent but code was never updated to match.",
  "",
  "Score = pairedInvariants.length / totalInvariants [0..1]. Be precise.",
  "Cite specific line patterns or absence of patterns as evidenceRef.",
  "",
  "Respond ONLY with JSON:",
  '{ "pairedInvariants": ["inv-1"], "unpairedInvariants": [{ "id": "inv-2", "type": "code-drift", "evidenceRef": "..." }], "score": 0.5, "rationale": "..." }',
].join("\n");

async function geminiAnalyze(
  code: string,
  invariants: IntentStrand["invariants"],
): Promise<GeminiPairOutput> {
  const invariantText = invariants
    .map(
      (inv) =>
        `${inv.id}: ${inv.rule}` +
        (inv.compliance ? " [COMPLIANCE REQUIREMENT]" : "") +
        `\n  rationale: ${inv.rationale}`,
    )
    .join("\n");

  const result = await gemini.analyze({
    parts: [
      {
        text:
          `Source code:\n\`\`\`\n${code.slice(0, 8000)}\n\`\`\`\n\n` +
          `Invariants to base-pair:\n${invariantText}`,
      },
    ],
    systemPrompt: GEMINI_SYSTEM,
    json: true,
  });

  return GeminiPairOutputSchema.parse(JSON.parse(result.content));
}

// ── Sarvam mismatch explanation + correction ───────────────────────────────────

const SARVAM_EXPLAIN_SYSTEM = [
  "You are HELIX's Genome organ explaining an intent-code mismatch.",
  "Given an unpaired invariant and the module source code, produce:",
  "  explanation: 1-3 sentences explaining exactly why the invariant is not satisfied.",
  "  suggestedPatch: a minimal unified diff (--- a/path +++ b/path @@ ... @@) that",
  "    would make the code satisfy the invariant. The path MUST start with apps/target/.",
  "The patch must be minimal — only add what is strictly needed to enforce the invariant.",
  "Respond ONLY with JSON: { \"explanation\": string, \"suggestedPatch\": string }",
].join("\n");

async function sarvamExplain(
  mismatch: PairMismatch,
  code: string,
  inv: IntentStrand["invariants"][number],
): Promise<{ explanation: string; suggestedPatch: string }> {
  const result = await sarvam.chat({
    messages: [
      { role: "system", content: SARVAM_EXPLAIN_SYSTEM },
      {
        role: "user",
        content: [
          `Unpaired invariant:`,
          `  ID: ${inv.id}`,
          `  Rule: ${inv.rule}`,
          `  Rationale: ${inv.rationale}`,
          `  Compliance: ${inv.compliance ?? false}`,
          `  Mismatch type: ${mismatch.type}`,
          `  Evidence: ${mismatch.evidenceRef}`,
          ``,
          `Source code:`,
          "```",
          code.slice(0, 5000),
          "```",
          ``,
          `Explain the divergence and propose a minimal correction patch.`,
        ].join("\n"),
      },
    ],
    schema: SarvamCorrectionSchema,
    temperature: 0.2,
  });
  return SarvamCorrectionSchema.parse(JSON.parse(result.content));
}

// ── pairGenome ─────────────────────────────────────────────────────────────────

export async function pairGenome(
  moduleId: string,
  deps?: PairGenomeDeps,
): Promise<PairGenomeResult> {
  await connectDb();

  // Load intent strand.
  const existing = await listIntentStrands({ moduleId } as Partial<IntentStrand>);
  const strand = existing[0];
  if (!strand) {
    throw new ValidationError(
      `pairGenome: no intent strand found for moduleId "${moduleId}". Run captureIntent first.`,
    );
  }

  // Read module source — GitHub-indexed strands have moduleId "owner/repo/module".
  // Local strands (apps/target/...) are read from disk.
  let code: string;
  const ghMatch = moduleId.match(/^([^/]+)\/([^/]+)\/(.+)$/);
  const localPath = resolve(REPO_ROOT, moduleId);
  if (ghMatch && !existsSync(localPath)) {
    const [, owner, repo, modName] = ghMatch as [string, string, string, string];
    const conn = await findGitHubConnection(owner, repo);
    if (!conn) {
      throw new ValidationError(
        `pairGenome: GitHub strand "${moduleId}" has no OAuth connection. Connect the repo first.`,
      );
    }
    const tree = await getRepoTree(conn.accessToken, owner, repo);
    const moduleFiles = tree.filter(
      (f) => f.path === modName || f.path.startsWith(`${modName}/`),
    );
    if (moduleFiles.length === 0) {
      throw new ValidationError(
        `pairGenome: no files found for module "${modName}" in ${owner}/${repo}.`,
      );
    }
    const parts: string[] = [];
    for (const entry of moduleFiles.slice(0, 20)) {
      const file = await ghReadFile(conn.accessToken, owner, repo, entry.path);
      if (file) parts.push(`// ${entry.path}\n${file.content}`);
    }
    code = parts.join("\n\n");
  } else {
    if (!existsSync(localPath)) {
      throw new ValidationError(`pairGenome: module file not found at ${localPath}.`);
    }
    code = readFileSync(localPath, "utf8");
  }

  // Gemini base-pair analysis (wide-context — Gemini is correct here per CLAUDE.md).
  const analyze = deps?.analyze ?? geminiAnalyze;
  const pairOutput = await analyze(code, strand.invariants);

  // Build structured mismatch objects.
  const mismatches: PairMismatch[] = pairOutput.unpairedInvariants.map((u) => {
    const inv = strand.invariants.find((i) => i.id === u.id);
    return {
      invariantId: u.id,
      type: u.type,
      description: inv?.rule ?? `Invariant ${u.id} not found in strand`,
      evidenceRef: u.evidenceRef,
    };
  });

  // Sarvam explains each mismatch, proposes a correction, then routes through the
  // Shadow gate (verifyCorrection dep). No correction is promotable without a
  // shadow_proof with verdict:'promote'. This is the Shadow invariant applied to Genome.
  const corrections: CorrectionProposal[] = [];
  const explain = deps?.explain;
  const verifyCorrection = deps?.verifyCorrection;

  for (const mismatch of mismatches) {
    const inv = strand.invariants.find((i) => i.id === mismatch.invariantId);
    if (!inv) continue;

    const correctionData = explain
      ? await explain(mismatch, code)
      : await sarvamExplain(mismatch, code, inv);

    // Build the proposal with invariant metadata so verifyCorrection can infer
    // the vulnClass for Shadow traffic case generation (see inferVulnClassFromInvariant).
    const proposal: CorrectionProposal = {
      invariantId: mismatch.invariantId,
      invariantRule: inv.rule,
      invariantCompliance: inv.compliance ?? false,
      explanation: correctionData.explanation,
      suggestedPatch: correctionData.suggestedPatch,
      requiresShadowVerification: true,
    };

    // ── SHADOW GATE ──────────────────────────────────────────────────────────
    // Route the proposal through verifyCorrection (the Shadow verification dep).
    // When wired: applies to Shadow twin → verifyEquivalence → returns proof.
    // When NOT_WIRED: verifyCorrection is absent → promotable:false, no proof.
    // Per the Shadow invariant: the real target is NEVER written without proof.
    if (verifyCorrection) {
      try {
        const proof = await verifyCorrection(proposal);
        corrections.push({ ...proposal, proof, promotable: proof.verdict === "promote" });
      } catch {
        // Shadow verification failed or rejected — correction is not promotable.
        // The proposal is still returned for operator visibility.
        corrections.push({ ...proposal, promotable: false });
      }
    } else {
      // No Shadow routing available — explicitly mark as not promotable.
      corrections.push({ ...proposal, promotable: false });
    }
  }

  // Persist updated pairing.
  const now = new Date().toISOString();
  const updatedPairing = {
    score: pairOutput.score,
    lastChecked: now,
    unpairedInvariants: mismatches.map((m) => m.invariantId),
  };
  const updated = await updateIntentStrand(strand._id, { pairing: updatedPairing });

  const resultStrand: HelixDoc<IntentStrand> = updated
    ? { ...updated, pairing: updatedPairing }
    : { ...strand, pairing: updatedPairing };

  return {
    strand: resultStrand,
    score: pairOutput.score,
    mismatches,
    corrections,
  };
}
