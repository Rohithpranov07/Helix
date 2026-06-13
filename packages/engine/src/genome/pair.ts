import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { ValidationError, type IntentStrand } from "@helix/shared";
import { gemini, sarvam } from "@helix/ai";
import { connectDb, listIntentStrands, updateIntentStrand } from "@helix/db";
import type { HelixDoc } from "@helix/db";

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

export interface CorrectionProposal {
  invariantId: string;
  explanation: string;
  suggestedPatch: string;
  requiresShadowVerification: true;
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
   * NOT_WIRED by default: Shadow verification gate for correction proposals.
   * Wire to verifyEquivalence before any correction can be promoted to target.
   * If not wired, calling this throws — preventing unauthorized promotion.
   */
  verifyCorrection?: (proposal: CorrectionProposal) => Promise<void>;
}

// ── Exported NOT_WIRED gate (testable seam) ───────────────────────────────────

export const NOT_WIRED_VERIFY_CORRECTION: Required<PairGenomeDeps>["verifyCorrection"] =
  async (_proposal: CorrectionProposal): Promise<void> => {
    throw new ValidationError(
      "verifyCorrection is NOT_WIRED — wire to verifyEquivalence before promoting any correction to target.",
    );
  };

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
  "  suggestedPatch: a minimal unified diff (--- a/path +++ b/path) that would make the code satisfy the invariant.",
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

/**
 * Pairs the live source code of `moduleId` against its stored intent strand.
 *
 * Gemini reads the whole file + invariants (wide-context base-pair, per CLAUDE.md).
 * Sarvam explains each mismatch and proposes a minimal correction.
 * Corrections are always flagged requiresShadowVerification:true — the
 * verifyCorrection dep (NOT_WIRED by default) is the Shadow gate: no correction
 * reaches the real target without being routed through verifyEquivalence first.
 */
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

  // Read the source file from disk.
  const absPath = resolve(REPO_ROOT, moduleId);
  if (!existsSync(absPath)) {
    throw new ValidationError(`pairGenome: module file not found at ${absPath}.`);
  }
  const code = readFileSync(absPath, "utf8");

  // Gemini base-pair analysis (wide-context — Gemini is the correct provider here per CLAUDE.md).
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

  // Sarvam explains each mismatch and proposes a correction.
  const corrections: CorrectionProposal[] = [];
  const explain = deps?.explain;

  for (const mismatch of mismatches) {
    const inv = strand.invariants.find((i) => i.id === mismatch.invariantId);
    if (!inv) continue;

    const correctionData = explain
      ? await explain(mismatch, code)
      : await sarvamExplain(mismatch, code, inv);

    corrections.push({
      invariantId: mismatch.invariantId,
      explanation: correctionData.explanation,
      suggestedPatch: correctionData.suggestedPatch,
      requiresShadowVerification: true,
    });
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
