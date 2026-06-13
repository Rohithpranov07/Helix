/**
 * T7.2 — Repair enzyme: Consolidator (Metabolism organ)
 *
 * consolidate(repoPath, deps?):
 *   1. Collects source files from the repo.
 *   2. Sarvam (PRIMARY LLM) scans for duplicated implementations — identical or
 *      near-identical code blocks that should be extracted to a shared location.
 *   3. For each duplication, Sarvam synthesizes a minimal consolidation patch
 *      (unified diff) that extracts the shared code and updates all consumers.
 *   4. The patch MUST pass verifyEquivalence before any promotion. The Shadow
 *      invariant applies here identically to the Immune organ: no write reaches
 *      the real target without a shadow_proof with verdict:'promote'.
 *      assertPromotable is called explicitly — it throws VerificationError on reject.
 *   5. After all approved consolidations are promoted, measureEntropy re-runs to
 *      show the temperature bending down (the §6 demo moment).
 *   6. Returns before/after EntropyPoints + the set of collapsed duplication IDs.
 *
 * Designed to be scheduled by n8n on every merge/deploy (§6 nightly digestion).
 * All five action seams are injectable so the orchestrator is fully testable now.
 */
import { z } from "zod";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { ValidationError, VerificationError, type ShadowProof, type VulnClass } from "@helix/shared";
import { sarvam } from "@helix/ai";
import { connectDb, listEntropyPoints } from "@helix/db";
import type { HelixDoc } from "@helix/db";
import type { EntropyPoint } from "@helix/shared";
import { assertPromotable } from "../immune/heal.js";
import { assertPatchSafe, type Patch, type ShadowApplyResult } from "../immune/patch.js";
import { collectRepoSources } from "./temperature.js";
import { measureEntropy } from "./temperature.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(__dirname, "../../../../");
const SHADOW_STAGING = resolve(REPO_ROOT, "shadow/staging");

// ── Duplication model ─────────────────────────────────────────────────────────

export interface Duplication {
  id: string;
  pattern: string;
  files: string[];
  consolidationTarget: string;
  rationale: string;
}

const DuplicationSchema = z.object({
  duplications: z
    .array(
      z.object({
        id: z.string().min(1),
        pattern: z.string().min(5),
        files: z.array(z.string().min(1)).min(2).max(6),
        consolidationTarget: z.string().min(1),
        rationale: z.string().min(5),
      }),
    )
    .max(5),
});

// ── Consolidation patch schema ─────────────────────────────────────────────────

const ConsolidationPatchOutputSchema = z.object({
  files: z
    .array(
      z.object({
        path: z.string().min(1),
        diff: z.string().min(1),
      }),
    )
    .min(1)
    .max(6),
  rationale: z.string().min(5),
});

// ── Public types ───────────────────────────────────────────────────────────────

export type ConsolidateOutcome = "consolidated" | "skipped" | "escalated";

export interface ConsolidateEvent {
  duplicationId: string;
  outcome: ConsolidateOutcome;
  detail: string;
  proofId?: string;
  at: string;
}

export interface ConsolidateResult {
  consolidated: string[];
  skipped: string[];
  proofs: ShadowProof[];
  before: EntropyPoint;
  after: EntropyPoint;
  temperatureDelta: number;
}

export interface ConsolidateDeps {
  collectSources?: (repoPath: string) => string;
  findDuplications?: (sources: string) => Promise<Duplication[]>;
  synthesizePatch?: (dup: Duplication, sources: string) => Promise<Patch>;
  applyShadow?: (patch: Patch) => Promise<ShadowApplyResult>;
  verify?: (changeRef: string) => Promise<ShadowProof>;
  promote?: (patch: Patch) => Promise<void>;
  measureAfter?: (repoPath: string) => Promise<HelixDoc<EntropyPoint>>;
  maxConsolidations?: number;
  onEvent?: (event: ConsolidateEvent) => void | Promise<void>;
}

// ── NOT_WIRED seams ───────────────────────────────────────────────────────────

const NOT_WIRED = (name: string): never => {
  throw new ValidationError(
    `${name} is NOT_WIRED — consolidate requires it via ConsolidateDeps. ` +
      "It will NEVER promote a consolidation without a verdict:'promote' shadow_proof.",
  );
};

// ── Sarvam: find duplications ─────────────────────────────────────────────────

const FIND_SYSTEM = [
  "You are HELIX's Metabolism organ scanning for duplicated code that should be consolidated.",
  "Analyse the provided TypeScript/TSX source files.",
  "Find up to 4 cases of IDENTICAL or near-identical code that is copy-pasted across files:",
  "  - Duplicated interface or type definitions",
  "  - Duplicated function implementations",
  "  - Duplicated constant/mock data with the same shape",
  "For each duplication:",
  "  id: short kebab-case identifier (e.g. 'product-interface')",
  "  pattern: one-line description of what is duplicated",
  "  files: list of repo-relative paths that contain the duplicate",
  "  consolidationTarget: the repo-relative path where the shared impl should live",
  "  rationale: why consolidating this reduces entropy",
  "All paths MUST start with 'apps/target/'.",
  "Return an EMPTY duplications array if no meaningful duplication is found.",
  'Respond ONLY with JSON: { "duplications": [...] }',
].join("\n");

async function sarvamFindDuplications(sources: string): Promise<Duplication[]> {
  const result = await sarvam.chat({
    messages: [
      { role: "system", content: FIND_SYSTEM },
      { role: "user", content: `Source files to scan:\n\n${sources.slice(0, 30_000)}` },
    ],
    schema: DuplicationSchema,
    temperature: 0.1,
  });
  const parsed = DuplicationSchema.parse(JSON.parse(result.content));
  return parsed.duplications;
}

// ── Sarvam: synthesize consolidation patch ────────────────────────────────────

const SYNTH_SYSTEM = [
  "You are HELIX's Metabolism organ synthesizing a consolidation patch.",
  "You are given a duplication report and the source code.",
  "Produce a MINIMAL set of unified diffs that:",
  "  1. Creates or extends the consolidationTarget file with the shared implementation.",
  "  2. Removes the duplicate from each file listed in 'files', replacing with an import.",
  "Each file path MUST start with 'apps/target/'.",
  "The diffs must be valid unified-diff format: --- a/<path>, +++ b/<path>, @@ ... @@",
  "Keep changes minimal — only extract the duplicate, do not refactor anything else.",
  'Respond ONLY with JSON: { "files": [{ "path": string, "diff": string }], "rationale": string }',
].join("\n");

async function sarvamSynthesizePatch(dup: Duplication, sources: string): Promise<Patch> {
  const result = await sarvam.chat({
    messages: [
      { role: "system", content: SYNTH_SYSTEM },
      {
        role: "user",
        content: [
          `Duplication to consolidate:`,
          `  id: ${dup.id}`,
          `  pattern: ${dup.pattern}`,
          `  files: ${dup.files.join(", ")}`,
          `  consolidationTarget: ${dup.consolidationTarget}`,
          `  rationale: ${dup.rationale}`,
          ``,
          `Relevant source (first 20 000 chars):`,
          sources.slice(0, 20_000),
        ].join("\n"),
      },
    ],
    schema: ConsolidationPatchOutputSchema,
    temperature: 0.1,
  });
  const out = ConsolidationPatchOutputSchema.parse(JSON.parse(result.content));
  const patch: Patch = { files: out.files, rationale: out.rationale };
  assertPatchSafe(patch);
  return patch;
}

// ── vulnClass inference for meta.json ────────────────────────────────────────

function inferConsolidationVulnClass(dup: Duplication): VulnClass {
  const target = dup.consolidationTarget.toLowerCase();
  if (target.includes("search") || target.includes("product")) return "SQLi";
  if (target.includes("admin") || target.includes("order")) return "authBypass";
  if (target.includes("auth") || target.includes("login")) return "authBypass";
  if (target.includes("admin") || target.includes("client")) return "secretLeak";
  if (target.includes("utils") || target.includes("supabase")) return "missingRLS";
  return "SQLi";
}

// ── consolidate ───────────────────────────────────────────────────────────────

/**
 * Runs the consolidator repair enzyme over a repository.
 *
 * Finds duplications with Sarvam, synthesizes minimal patches, routes every patch
 * through the Shadow gate (verifyEquivalence + assertPromotable) before promoting.
 * No consolidation reaches the real target without a shadow_proof with verdict:'promote'.
 * After all approved consolidations the enzyme re-measures entropy to show
 * temperature bending down (the §6 "metabolism on" demo moment).
 *
 * Designed to be triggered by n8n on every merge/deploy as part of nightly digestion.
 */
export async function consolidate(
  repoPath: string,
  deps?: ConsolidateDeps,
): Promise<ConsolidateResult> {
  await connectDb();

  const {
    collectSources = collectRepoSources,
    findDuplications = sarvamFindDuplications,
    synthesizePatch = sarvamSynthesizePatch,
    applyShadow = () => NOT_WIRED("applyShadow"),
    verify = () => NOT_WIRED("verifyEquivalence"),
    promote = () => NOT_WIRED("promote"),
    measureAfter = (p: string) => measureEntropy(p),
    maxConsolidations = 3,
    onEvent = defaultOnEvent,
  } = deps ?? {};

  const emit = (
    duplicationId: string,
    outcome: ConsolidateOutcome,
    detail: string,
    extra: Partial<ConsolidateEvent> = {},
  ): void | Promise<void> =>
    onEvent({ duplicationId, outcome, detail, at: new Date().toISOString(), ...extra });

  // ── 1. Capture before temperature from last stored point ──────────────────
  const history = await listEntropyPoints(1);
  const before: EntropyPoint = history[0] ?? {
    ts: new Date().toISOString(),
    temperature: 0,
    dims: { duplication: 0, patternVariance: 0, coupling: 0, vulnDensity: 0, comprehension: 0 },
    projectedRewriteWeeks: 0,
  };

  // ── 2. Collect source files ───────────────────────────────────────────────
  const sources = collectSources(repoPath);
  if (!sources.trim()) {
    throw new ValidationError(`consolidate: no source files found under "${repoPath}".`);
  }

  // ── 3. Sarvam finds duplications ──────────────────────────────────────────
  const allDuplications = await findDuplications(sources);
  const targets = allDuplications.slice(0, maxConsolidations);

  const consolidated: string[] = [];
  const skipped: string[] = [];
  const proofs: ShadowProof[] = [];

  // ── 4. Process each duplication through the Shadow gate ───────────────────
  for (const dup of targets) {
    // 4a. Sarvam synthesizes the consolidation patch.
    let patch: Patch;
    try {
      patch = await synthesizePatch(dup, sources);
    } catch (err) {
      await emit(dup.id, "skipped", `Patch synthesis failed: ${String(err)}`);
      skipped.push(dup.id);
      continue;
    }

    // 4b. Apply to Shadow twin ONLY — never the real target.
    let applied: ShadowApplyResult;
    try {
      applied = await applyShadow(patch);
    } catch (err) {
      await emit(dup.id, "skipped", `Shadow apply failed: ${String(err)}`);
      skipped.push(dup.id);
      continue;
    }

    // 4c. Write meta.json so verifyEquivalence can build the right traffic cases.
    const vulnClass = inferConsolidationVulnClass(dup);
    const endpoint =
      `/${dup.consolidationTarget.split("/").pop()?.replace(/\.(tsx?|jsx?)$/, "") ?? "index"}`;
    mkdirSync(resolve(SHADOW_STAGING, applied.patchRef), { recursive: true });
    writeFileSync(
      resolve(SHADOW_STAGING, applied.patchRef, "meta.json"),
      JSON.stringify({ findingId: dup.id, vulnClass, endpoint }),
      "utf8",
    );

    // 4d. Behaviour-equivalence proof — Shadow invariant: no promotion without
    //     verdict:'promote'. assertPromotable throws VerificationError on reject.
    let proof: ShadowProof;
    try {
      proof = await verify(applied.patchRef);
    } catch (err) {
      await emit(dup.id, "skipped", `Shadow verification failed: ${String(err)}`);
      skipped.push(dup.id);
      continue;
    }

    try {
      assertPromotable(proof);
    } catch (err) {
      if (err instanceof VerificationError) {
        await emit(dup.id, "escalated",
          `Shadow rejected consolidation (verdict:${proof.verdict}). Real target untouched.`,
          { proofId: proof.proofId },
        );
        skipped.push(dup.id);
        continue;
      }
      throw err;
    }

    // 4e. Promote — real target written here for the first and only time.
    try {
      await promote(patch);
    } catch (err) {
      await emit(dup.id, "skipped", `Promotion failed: ${String(err)}`);
      skipped.push(dup.id);
      continue;
    }

    proofs.push(proof);
    consolidated.push(dup.id);
    await emit(dup.id, "consolidated",
      `${dup.pattern} consolidated into ${dup.consolidationTarget}. Shadow proof: ${proof.proofId}`,
      { proofId: proof.proofId },
    );
  }

  // ── 5. Re-measure entropy — temperature should bend down ──────────────────
  const afterDoc = await measureAfter(repoPath);
  const after: EntropyPoint = afterDoc;

  const temperatureDelta = after.temperature - before.temperature;
  // eslint-disable-next-line no-console
  console.log(
    `[consolidator] consolidated=${consolidated.length} skipped=${skipped.length} ` +
      `temperature: ${before.temperature.toFixed(3)} → ${after.temperature.toFixed(3)} ` +
      `(Δ${temperatureDelta >= 0 ? "+" : ""}${temperatureDelta.toFixed(3)})`,
  );

  return { consolidated, skipped, proofs, before, after, temperatureDelta };
}

function defaultOnEvent(event: ConsolidateEvent): void {
  // eslint-disable-next-line no-console
  console.log("[consolidator]", JSON.stringify(event));
}
