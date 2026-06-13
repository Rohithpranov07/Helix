/**
 * Genome drift detector — detects divergence between code and intent strands.
 *
 * Flow per module:
 *   1. Load intent strand from DB (seeded by repoIndex or prior capture).
 *   2. Gemini reads the current code + intent strand together (wide-context).
 *   3. Sarvam reasons about specific mismatches (strict-JSON).
 *   4. For each mismatch: Sarvam synthesizes a minimal patch (strict-JSON).
 *   5. Create a shadow branch on GitHub (helix-shadow-<ts>).
 *   6. Persist DriftReport to drift_report collection.
 *
 * Per §3 spec: "Flag mutations in both directions" and
 * "reason about the mismatch + propose the minimal correction → Shadow for verification."
 */
import type { DriftMismatch, DriftReport } from "@helix/shared";
import {
  connectDb,
  listIntentStrands,
  updateIntentStrand,
  createDriftReport,
} from "@helix/db";
import { gemini, sarvam } from "@helix/ai";
import { z } from "zod";
import { getRepoTree, readFile, getDefaultBranchSha, createBranch } from "./github.js";

// ── Sarvam JSON schemas ───────────────────────────────────────────────────────

const MismatchItemSchema = z.object({
  invariantId: z.string(),
  description: z.string(),
  affectedFile: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
});

const MismatchListSchema = z.object({
  pairingScore: z.number().min(0).max(1),
  unpairedInvariants: z.array(z.string()),
  mismatches: z.array(MismatchItemSchema),
  summary: z.string(),
});

const PatchSchema = z.object({
  diff: z.string(),
  newContent: z.string(),
  rationale: z.string(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const SKIP_PATTERNS = [
  "node_modules", ".next", "dist", "build", "coverage", ".git",
  "pnpm-lock", "package-lock", "yarn.lock", "__pycache__",
];

const SOURCE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java",
  ".rb", ".php", ".cs", ".sql",
]);

function shouldSkip(path: string): boolean {
  return SKIP_PATTERNS.some((p) => path.includes(p));
}

function isSourceFile(path: string): boolean {
  const ext = path.slice(path.lastIndexOf("."));
  return SOURCE_EXTS.has(ext);
}

function moduleOf(path: string): string {
  const parts = path.split("/");
  return parts.length > 1 ? (parts[0] ?? "root") : "root";
}

function makeDriftId(): string {
  return `drift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface DetectRepoDriftOptions {
  token: string;
  owner: string;
  repo: string;
  moduleId?: string; // if provided, scan only this module
}

export async function detectRepoDrift(
  opts: DetectRepoDriftOptions,
): Promise<DriftReport> {
  const { token, owner, repo, moduleId } = opts;

  await connectDb();

  // 1. Load intent strands for this repo
  const allStrands = await listIntentStrands();
  const repoPrefix = `${owner}/${repo}/`;
  const strands = allStrands.filter(
    (s) =>
      s.moduleId.startsWith(repoPrefix) &&
      (!moduleId || s.moduleId === moduleId || s.moduleId.endsWith(`/${moduleId}`)),
  );

  if (strands.length === 0) {
    throw new Error(
      `No intent strands found for ${owner}/${repo}${moduleId ? `/${moduleId}` : ""}. ` +
      `Run genome-index first.`,
    );
  }

  // 2. Fetch current file tree
  const tree = await getRepoTree(token, owner, repo);

  // Group files by module
  const moduleFiles = new Map<string, string[]>();
  for (const f of tree) {
    if (shouldSkip(f.path) || !isSourceFile(f.path)) continue;
    const mod = moduleOf(f.path);
    if (!moduleFiles.has(mod)) moduleFiles.set(mod, []);
    moduleFiles.get(mod)!.push(f.path);
  }

  const allMismatches: DriftMismatch[] = [];
  let worstScore = 1.0;

  for (const strand of strands) {
    try {
    const modName = strand.moduleId.split("/").pop() ?? strand.moduleId;
    const files = moduleFiles.get(modName) ?? [];

    // Read current source
    let sourceContent = "";
    const fileContents = new Map<string, { content: string; sha: string }>();
    for (const path of files.slice(0, 20)) {
      const f = await readFile(token, owner, repo, path);
      if (!f) continue;
      fileContents.set(path, f);
      sourceContent += `\n\n=== FILE: ${path} ===\n${f.content.slice(0, 4_000)}`;
      if (sourceContent.length > 50_000) break;
    }

    if (!sourceContent.trim()) continue;

    // 3. Gemini wide-context: compare code vs intent
    let geminiAnalysis = "";
    try {
      const geminiResult = await gemini.analyze({
        parts: [
          {
            text:
              `INTENT STRAND for module "${modName}" (${owner}/${repo}):\n` +
              `Purpose: ${strand.purpose}\n` +
              `Invariants:\n${strand.invariants.map((i) => `  [${i.id}] ${i.rule} — ${i.rationale}`).join("\n")}\n` +
              `Edge decisions: ${strand.edgeDecisions.join("; ")}\n\n` +
              `CURRENT CODE:\n${sourceContent}\n\n` +
              `Question: Does the current code faithfully implement every stated invariant? ` +
              `List any invariants that appear violated, missing, or only partially implemented. ` +
              `Be specific about which file and line appears to cause the drift.`,
          },
        ],
        systemPrompt:
          "You are a code-intent alignment analyst. Be precise. Cite specific invariant IDs.",
      });
      geminiAnalysis = geminiResult.content;
    } catch {
      geminiAnalysis = "Gemini unavailable — proceeding with Sarvam analysis only.";
    }

    // 4. Sarvam: structured mismatch reasoning (strict-JSON)
    const analysisResult = await sarvam.chat({
      messages: [
        {
          role: "system",
          content:
            "You are HELIX Genome. Analyze code-vs-intent drift and output ONLY valid JSON.\n" +
            "Output EXACTLY: {\"pairingScore\":0.0-1.0,\"unpairedInvariants\":[\"id\"],\"mismatches\":[{\"invariantId\":\"id\",\"description\":\"what is wrong\",\"affectedFile\":\"path/to/file.ts\",\"severity\":\"high\"}],\"summary\":\"one sentence\"}\n" +
            "pairingScore: 1.0 = fully paired, 0.0 = fully drifted. Only flag REAL violations, not style. Use empty arrays if nothing found.",
        },
        {
          role: "user",
          content:
            `Module: ${modName} — ${strand.purpose}\n\n` +
            `Intent invariants:\n${strand.invariants.map((i) => `[${i.id}] ${i.rule}`).join("\n")}\n\n` +
            `Gemini analysis:\n${geminiAnalysis}\n\n` +
            `Current code sample:\n${sourceContent.slice(0, 15_000)}`,
        },
      ],
      schema: MismatchListSchema,
      temperature: 0.1,
    });
    const analysis = JSON.parse(analysisResult.content) as z.infer<typeof MismatchListSchema>;

    // Update pairing score on the strand
    await updateIntentStrand(strand._id, {
      pairing: {
        score: analysis.pairingScore,
        lastChecked: new Date().toISOString(),
        unpairedInvariants: analysis.unpairedInvariants,
      },
    });

    if (analysis.pairingScore < worstScore) worstScore = analysis.pairingScore;

    // 5. For each mismatch: Sarvam synthesizes a minimal patch
    for (const mismatch of analysis.mismatches) {
      const file = fileContents.get(mismatch.affectedFile);
      if (!file) continue;

      const patchResult = await sarvam.chat({
        messages: [
          {
            role: "system",
            content:
              "You are HELIX Genome. Generate a minimal patch to fix a code-intent drift.\n" +
              "Output ONLY valid JSON with EXACTLY: {\"diff\":\"unified diff string\",\"newContent\":\"complete corrected file content\",\"rationale\":\"one sentence\"}\n" +
              "The fix must restore the invariant without changing any other behavior.",
          },
          {
            role: "user",
            content:
              `Invariant violated: [${mismatch.invariantId}] — ${mismatch.description}\n\n` +
              `File: ${mismatch.affectedFile}\n\n` +
              `Current content:\n${file.content}\n\n` +
              `Module purpose: ${strand.purpose}\n` +
              `Invariant rule: ${strand.invariants.find((i) => i.id === mismatch.invariantId)?.rule ?? "see description"}`,
          },
        ],
        schema: PatchSchema,
        temperature: 0.1,
      });
      const patch = JSON.parse(patchResult.content) as z.infer<typeof PatchSchema>;

      allMismatches.push({
        invariantId: mismatch.invariantId,
        description: mismatch.description,
        affectedFile: mismatch.affectedFile,
        diff: patch.diff,
        newContent: patch.newContent,
      });
    }
    } catch (modErr) {
      console.warn(`[genome/drift] skipping module ${strand.moduleId}:`, modErr instanceof Error ? modErr.message : modErr);
    }
  }

  // 6. Create shadow branch on GitHub (helix-shadow-<ts>)
  const shadowBranch = `helix-shadow-${Date.now()}`;
  let defaultBranch = "main";
  try {
    const { getRepo } = await import("./github.js");
    const repoInfo = await getRepo(token, owner, repo);
    defaultBranch = repoInfo.default_branch;
    const sha = await getDefaultBranchSha(token, owner, repo, defaultBranch);
    await createBranch(token, owner, repo, shadowBranch, sha);
  } catch (e) {
    // If branch creation fails, we still persist the report — PR step will retry
    console.warn("Shadow branch creation failed:", e instanceof Error ? e.message : e);
  }

  // 7. Persist DriftReport
  const driftId = makeDriftId();
  const report: DriftReport = {
    driftId,
    strandId: strands[0]!.moduleId,
    githubOwner: owner,
    githubRepo: repo,
    shadowBranch,
    detectedAt: new Date().toISOString(),
    mismatches: allMismatches,
    status: allMismatches.length === 0 ? "approved" : "pending_approval",
  };

  await createDriftReport(report);
  return report;
}
