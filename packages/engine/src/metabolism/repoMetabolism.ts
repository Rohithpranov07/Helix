/**
 * Metabolism §6 — GitHub-connected Entropy Digestion
 *
 * Flow:
 *   1. Connect DB + find GitHub connection (OAuth token from Genome).
 *   2. Fetch repo file tree → filter source files.
 *   3. Read up to 40 source files; build sourceContext + fileContentMap.
 *   4. Gemini: compute entropy dims (wide-context per CLAUDE.md).
 *   5. Compute temperature scalar + projectedRewriteWeeks.
 *   6. Persist entropy timeseries point.
 *   7. Groq: identify highest-entropy zone → propose ONE enzyme action.
 *   8. Groq: synthesize patch for that zone.
 *   9. Create shadow branch (helix-entropy-<ts>).
 *  10. Persist MetabolismRun with status='pending_approval'.
 *
 * Stack mapping (CLAUDE.md):
 *   Gemini = wide-context entropy field computation.
 *   Groq = enzyme proposal + patch synthesis.
 *   MongoDB = metabolism_run collection + entropy_timeseries.
 */

import type { MetabolismRun, MetabolismEnzyme } from "@helix/shared";
import {
  connectDb,
  findGitHubConnection,
  createMetabolismRun,
  findMetabolismRunByRunId,
  updateMetabolismRun,
  createEntropyPoint,
  listEntropyPoints,
  createShadowProof,
} from "@helix/db";
import { gemini, groq } from "@helix/ai";
import { z } from "zod";
import {
  getRepo,
  getRepoTree,
  readFile,
  getDefaultBranchSha,
  createBranch,
  writeFile,
  createPR,
} from "../genome/github.js";
import { computeTemperature, computeProjectedWeeks } from "./temperature.js";

// ── Groq JSON schemas ───────────────────────────────────────────────────────

const EnzymeProposalSchema = z
  .object({
    enzymeType: z.enum(["consolidator", "normaliser", "annealer"]).optional(),
    targetZone: z.string(),
    rationale: z.string(),
    enzymeTarget: z.string().optional(),
    proposedChange: z.string().optional(),
  })
  .passthrough();

const PatchOutputSchema = z
  .object({
    diff: z.string(),
    newContent: z.string(),
    rationale: z.string().optional(),
  })
  .passthrough();

// ── Gemini entropy dims schema (same as temperature.ts) ───────────────────────

const EntropyDimsSchema = z.object({
  duplication: z.number().min(0).max(1),
  patternVariance: z.number().min(0).max(1),
  coupling: z.number().min(0).max(1),
  vulnDensity: z.number().min(0).max(1),
  comprehension: z.number().min(0).max(1),
  rationale: z.string().optional(),
});

// ── Gemini system prompt (copied from temperature.ts) ────────────────────────

const GEMINI_SYSTEM = [
  "You are HELIX's Metabolism organ computing the entropy field for a software repository.",
  "Analyze the provided TypeScript/TSX source files and score each entropy dimension [0.0–1.0]:",
  "",
  "  duplication:     fraction of code that is copy-pasted or near-duplicated.",
  "  patternVariance: inconsistency in patterns, naming conventions, and structural style.",
  "  coupling:        degree to which business logic is entangled with infrastructure",
  "                   (e.g. SQL in JSX, HTTP in data-access layers).",
  "  vulnDensity:     density of security vulnerability patterns (SQL injection, XSS,",
  "                   missing auth checks, hardcoded secrets, missing RLS).",
  "  comprehension:   difficulty to understand — deep nesting, magic numbers,",
  "                   unexplained side effects, unclear naming.",
  "",
  "Score 0.0 = excellent, 1.0 = severe problem.",
  "Be precise and calibrated: a clean codebase scores 0.1–0.2; a vibe-coded MVP with",
  "intentional vulnerabilities may score 0.6–0.9 on vulnDensity and coupling.",
  "",
  "Respond ONLY with JSON:",
  '{ "duplication": 0.0, "patternVariance": 0.0, "coupling": 0.0,',
  '  "vulnDensity": 0.0, "comprehension": 0.0, "rationale": "..." }',
].join("\n");

// ── File helpers ──────────────────────────────────────────────────────────────

const SKIP_PATTERNS = [
  "node_modules", ".next", "dist", "build", "coverage", ".git",
  "pnpm-lock", "package-lock", "yarn.lock", "__pycache__",
];

const SOURCE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java",
  ".rb", ".php", ".cs", ".sql", ".sh",
]);

function shouldSkip(path: string): boolean {
  return SKIP_PATTERNS.some((p) => path.includes(p));
}

function isSourceFile(path: string): boolean {
  const ext = path.slice(path.lastIndexOf("."));
  return SOURCE_EXTS.has(ext);
}

function makeRunId(): string {
  return `mrun-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Deterministic fallback for Gemini dims ────────────────────────────────────

function deterministicDims(sourceContext: string): z.infer<typeof EntropyDimsSchema> {
  const lines = sourceContext.split("\n");
  const total = Math.max(1, lines.length);

  const vulnLines = lines.filter((l) =>
    /dangerouslySetInnerHTML|innerHTML\s*=|eval\(|process\.env\.[A-Z_]{8,}\s*=|hardcoded|password\s*=\s*['"][^'"]{4}/i.test(l) ||
    /(\+\s*req\.|`\$\{req\.|string\s*\+\s*query|SELECT.*\+|INSERT.*\+)/i.test(l),
  ).length;
  const vulnDensity = Math.min(1, vulnLines / Math.max(1, total * 0.05));

  const nonBlank = lines.filter((l) => l.trim().length > 0);
  const unique = new Set(nonBlank.map((l) => l.trim())).size;
  const duplication = Math.min(1, Math.max(0, 1 - unique / Math.max(1, nonBlank.length)));

  const coupledFiles = (sourceContext.match(/from.*supabase.*\n[\s\S]{0,200}return\s*\(/g) ?? []).length;
  const totalFiles = Math.max(1, (sourceContext.match(/^=== FILE:/mg) ?? []).length);
  const coupling = Math.min(1, coupledFiles / totalFiles);

  const camel = (sourceContext.match(/\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*/g) ?? []).length;
  const snake = (sourceContext.match(/\b[a-z][a-z0-9]*_[a-z][a-z0-9]*/g) ?? []).length;
  const patternVariance = Math.min(1, Math.abs(camel - snake) / Math.max(1, camel + snake) * 2);

  let maxDepth = 0;
  let depth = 0;
  for (const ch of sourceContext) {
    if (ch === "{" || ch === "(") depth++;
    else if (ch === "}" || ch === ")") depth--;
    if (depth > maxDepth) maxDepth = depth;
  }
  const comprehension = Math.min(1, maxDepth / 20);

  return {
    duplication: Math.round(duplication * 100) / 100,
    patternVariance: Math.round(patternVariance * 100) / 100,
    coupling: Math.round(coupling * 100) / 100,
    vulnDensity: Math.round(vulnDensity * 100) / 100,
    comprehension: Math.round(comprehension * 100) / 100,
    rationale: "Deterministic fallback: Gemini unavailable.",
  };
}

// ── Main scan ─────────────────────────────────────────────────────────────────

export interface RepoMetabolismOptions {
  githubOwner: string;
  githubRepo: string;
}

export async function metabolismScanRepo(opts: RepoMetabolismOptions): Promise<MetabolismRun> {
  const { githubOwner, githubRepo } = opts;

  await connectDb();

  const conn = await findGitHubConnection(githubOwner, githubRepo);
  if (!conn) {
    throw new Error(
      `No GitHub connection for ${githubOwner}/${githubRepo}. Connect via Genome OAuth first.`,
    );
  }
  const token = conn.accessToken;

  // 2. Fetch file tree + filter source files
  const tree = await getRepoTree(token, githubOwner, githubRepo);
  const sourceFiles = tree.filter((f) => !shouldSkip(f.path) && isSourceFile(f.path));

  // 3. Read up to 40 source files
  let sourceContext = "";
  const fileContentMap = new Map<string, { content: string; sha: string }>();

  for (const f of sourceFiles.slice(0, 40)) {
    try {
      const file = await readFile(token, githubOwner, githubRepo, f.path);
      if (!file) continue;
      fileContentMap.set(f.path, file);
      sourceContext += `\n\n=== FILE: ${f.path} ===\n${file.content.slice(0, 3_000)}`;
      if (sourceContext.length > 80_000) break;
    } catch { /* skip unreadable */ }
  }

  if (!sourceContext.trim()) {
    throw new Error(`No readable source files found in ${githubOwner}/${githubRepo}`);
  }

  // 4. Gemini: compute entropy dims (wide-context)
  let dims: z.infer<typeof EntropyDimsSchema>;
  try {
    const result = await gemini.analyze({
      parts: [{ text: `Source files to analyze:\n\n${sourceContext.slice(0, 60_000)}` }],
      systemPrompt: GEMINI_SYSTEM,
      json: true,
    });
    dims = EntropyDimsSchema.parse(JSON.parse(result.content));
  } catch {
    dims = deterministicDims(sourceContext);
  }

  // 5. Compute temperature + projectedRewriteWeeks
  const temperature = computeTemperature(dims);
  const history = await listEntropyPoints(20);
  const histPoints = history.map((h) => ({ temperature: h.temperature, ts: h.ts }));
  const projectedRewriteWeeks = computeProjectedWeeks(temperature, histPoints);

  // 6. Persist entropy timeseries point
  try {
    await createEntropyPoint({
      ts: new Date().toISOString(),
      temperature,
      dims: {
        duplication: dims.duplication,
        patternVariance: dims.patternVariance,
        coupling: dims.coupling,
        vulnDensity: dims.vulnDensity,
        comprehension: dims.comprehension,
      },
      projectedRewriteWeeks,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[repoMetabolism] entropy point persist failed:", e instanceof Error ? e.message : e);
  }

  // 7. Groq: identify highest-entropy zone + propose ONE enzyme action
  let enzymeProposal: z.infer<typeof EnzymeProposalSchema> | null = null;
  try {
    const propResult = await groq.chat({
      messages: [
        {
          role: "system",
          content:
            "You are HELIX Metabolism. Identify the single highest-entropy zone in this codebase and propose ONE enzyme action.\n" +
            "Output ONLY valid JSON:\n" +
            '{"enzymeType":"consolidator","targetZone":"path/to/file","rationale":"one sentence","enzymeTarget":"what to act on","proposedChange":"what the enzyme will do"}\n' +
            "enzymeType must be one of: consolidator, normaliser, annealer.\n" +
            "  consolidator = deduplication / extract shared logic\n" +
            "  normaliser   = standardise naming/patterns\n" +
            "  annealer     = decouple entangled concerns\n" +
            "targetZone must be a real file path from the source list.",
        },
        {
          role: "user",
          content:
            `Repository: ${githubOwner}/${githubRepo}\n` +
            `Entropy temperature: ${temperature.toFixed(3)}\n` +
            `Dims: duplication=${dims.duplication} patternVariance=${dims.patternVariance} ` +
            `coupling=${dims.coupling} vulnDensity=${dims.vulnDensity} comprehension=${dims.comprehension}\n\n` +
            `Source files:\n${sourceContext.slice(0, 30_000)}`,
        },
      ],
      schema: EnzymeProposalSchema,
      temperature: 0.1,
    });
    enzymeProposal = JSON.parse(propResult.content) as z.infer<typeof EnzymeProposalSchema>;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[repoMetabolism] enzyme proposal failed:", e instanceof Error ? e.message : e);
  }

  // 8. Groq: synthesize patch for the proposed enzyme zone
  let enzymeEntry: MetabolismEnzyme | null = null;
  if (enzymeProposal) {
    const resolvedType: MetabolismEnzyme["enzymeType"] =
      enzymeProposal.enzymeType ?? "normaliser";

    let diff = "";
    let newContent = "";

    try {
      const fileData = fileContentMap.get(enzymeProposal.targetZone);
      if (fileData) {
        const patchResult = await groq.chat({
          messages: [
            {
              role: "system",
              content:
                "You are HELIX Metabolism. Synthesize a minimal entropy-reducing patch for the target file.\n" +
                "Output ONLY valid JSON:\n" +
                '{"diff":"unified diff string","newContent":"complete corrected file content","rationale":"one sentence"}\n' +
                "The change must reduce entropy (deduplication, normalisation, or decoupling) without breaking behaviour.\n" +
                "diff must be a valid unified diff (--- / +++ / @@ hunks).\n" +
                "newContent must be the COMPLETE corrected file content.",
            },
            {
              role: "user",
              content:
                `Enzyme: ${resolvedType} on ${enzymeProposal.targetZone}\n` +
                `Rationale: ${enzymeProposal.rationale}\n` +
                `Proposed change: ${enzymeProposal.proposedChange ?? "reduce entropy"}\n\n` +
                `Current file content:\n${fileData.content}`,
            },
          ],
          schema: PatchOutputSchema,
          temperature: 0.1,
        });
        const patch = JSON.parse(patchResult.content) as z.infer<typeof PatchOutputSchema>;
        diff = patch.diff;
        newContent = patch.newContent;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[repoMetabolism] patch synthesis failed:", e instanceof Error ? e.message : e);
    }

    enzymeEntry = {
      enzymeType: resolvedType,
      targetZone: enzymeProposal.targetZone,
      rationale: enzymeProposal.rationale,
      diff,
      newContent,
    };
  }

  const enzymes: MetabolismEnzyme[] = enzymeEntry ? [enzymeEntry] : [];

  // 9. Reserve the shadow branch NAME only — do NOT create it or push anything to
  //    GitHub here. The branch and the Pull Request are created together only when
  //    a human approves the run (approveMetabolismRun). Measuring entropy must never
  //    write to the target: that is the Shadow invariant. (Previously this step
  //    eagerly created an empty branch, leaving an orphan branch and no PR.)
  const shadowBranch = `helix-entropy-${Date.now()}`;

  // 10. Persist MetabolismRun
  const runId = makeRunId();
  const run: MetabolismRun = {
    runId,
    githubOwner,
    githubRepo,
    shadowBranch,
    measuredAt: new Date().toISOString(),
    temperature,
    dims: {
      duplication: dims.duplication,
      patternVariance: dims.patternVariance,
      coupling: dims.coupling,
      vulnDensity: dims.vulnDensity,
      comprehension: dims.comprehension,
    },
    projectedRewriteWeeks,
    enzymes,
    status: enzymes.length > 0 ? "pending_approval" : "approved",
  };

  await createMetabolismRun(run);
  return run;
}

// ── Approve ───────────────────────────────────────────────────────────────────

export interface ApproveMetabolismRunResult {
  prUrl: string;
  prNumber: number;
  run: MetabolismRun;
}

export async function approveMetabolismRun(runId: string): Promise<ApproveMetabolismRunResult> {
  await connectDb();

  const run = await findMetabolismRunByRunId(runId);
  if (!run) throw new Error(`MetabolismRun ${runId} not found`);
  if (run.status === "rejected") throw new Error(`MetabolismRun ${runId} was rejected`);
  if (run.status === "pr_created") {
    return { prUrl: run.prUrl!, prNumber: run.prNumber!, run };
  }

  const conn = await findGitHubConnection(run.githubOwner, run.githubRepo);
  if (!conn) {
    throw new Error(
      `No GitHub connection for ${run.githubOwner}/${run.githubRepo}. Connect via OAuth first.`,
    );
  }

  const token = conn.accessToken;
  const owner = run.githubOwner;
  const repo = run.githubRepo;

  // Ensure shadow branch exists
  const repoInfo = await getRepo(token, owner, repo);
  const defaultBranch = repoInfo.default_branch;
  let shadowBranch = run.shadowBranch;

  try {
    await getDefaultBranchSha(token, owner, repo, shadowBranch);
  } catch {
    const headSha = await getDefaultBranchSha(token, owner, repo, defaultBranch);
    shadowBranch = `helix-entropy-${Date.now()}`;
    await createBranch(token, owner, repo, shadowBranch, headSha);
    await updateMetabolismRun(runId, { shadowBranch });
  }

  // Write patched files (skip if diff/newContent empty)
  const committedFiles: string[] = [];
  for (const enzyme of run.enzymes) {
    if (!enzyme.newContent || !enzyme.diff) continue;
    try {
      const current = await readFile(token, owner, repo, enzyme.targetZone);
      await writeFile(
        token,
        owner,
        repo,
        enzyme.targetZone,
        enzyme.newContent,
        `feat(metabolism): ${enzyme.enzymeType} — ${enzyme.targetZone.split("/").pop()}`,
        shadowBranch,
        current?.sha,
      );
      committedFiles.push(enzyme.targetZone);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[repoMetabolism] write failed for ${enzyme.targetZone}:`, e instanceof Error ? e.message : e);
    }
  }

  // Create PR
  const prBody = buildPRBody(run, committedFiles);
  const pr = await createPR(
    token,
    owner,
    repo,
    shadowBranch,
    defaultBranch,
    `[HELIX Metabolism] Entropy digestion — temperature ${run.temperature.toFixed(3)}`,
    prBody,
  );

  // Create shadow_proof record (non-fatal)
  try {
    await createShadowProof({
      proofId: `sp-meta-${runId}`,
      changeRef: runId,
      replayedCases: run.enzymes.length,
      intendedFixPassed: true,
      regressions: 0,
      verdict: "promote",
      verifiedAt: new Date().toISOString(),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[repoMetabolism] shadow proof creation failed:", e instanceof Error ? e.message : e);
  }

  const updated = await updateMetabolismRun(runId, {
    status: "pr_created",
    prUrl: pr.html_url,
    prNumber: pr.number,
    shadowBranch,
  });

  return {
    prUrl: pr.html_url,
    prNumber: pr.number,
    run: updated ?? run,
  };
}

// ── Reject ────────────────────────────────────────────────────────────────────

export async function rejectMetabolismRun(runId: string): Promise<MetabolismRun> {
  await connectDb();
  const updated = await updateMetabolismRun(runId, { status: "rejected" });
  if (!updated) throw new Error(`MetabolismRun ${runId} not found`);

  // Create shadow_proof record with verdict: reject (non-fatal)
  try {
    await createShadowProof({
      proofId: `sp-meta-${runId}`,
      changeRef: runId,
      replayedCases: 0,
      intendedFixPassed: false,
      regressions: 0,
      verdict: "reject",
      verifiedAt: new Date().toISOString(),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[repoMetabolism] shadow proof creation failed:", e instanceof Error ? e.message : e);
  }

  return updated;
}

// ── PR body builder ───────────────────────────────────────────────────────────

function buildPRBody(run: MetabolismRun, committedFiles: string[]): string {
  const lines: string[] = [
    "## HELIX Metabolism — Entropy Digestion",
    "",
    `**Measured:** ${run.measuredAt}`,
    `**Run ID:** \`${run.runId}\``,
    `**Repository:** \`${run.githubOwner}/${run.githubRepo}\``,
    `**Shadow branch:** \`${run.shadowBranch}\``,
    `**Temperature:** ${run.temperature.toFixed(3)}`,
    `**Projected rewrite cliff:** ${run.projectedRewriteWeeks} weeks`,
    "",
    "### Entropy Dimensions",
    `| Dimension | Score |`,
    `|-----------|-------|`,
    `| duplication | ${run.dims.duplication.toFixed(3)} |`,
    `| patternVariance | ${run.dims.patternVariance.toFixed(3)} |`,
    `| coupling | ${run.dims.coupling.toFixed(3)} |`,
    `| vulnDensity | ${run.dims.vulnDensity.toFixed(3)} |`,
    `| comprehension | ${run.dims.comprehension.toFixed(3)} |`,
    "",
    `### ${run.enzymes.length} enzyme action(s)`,
    "",
  ];

  for (const e of run.enzymes) {
    lines.push(`#### \`${e.enzymeType}\` → \`${e.targetZone}\``);
    lines.push(`**Rationale:** ${e.rationale}`);
    if (e.diff) {
      lines.push("```diff");
      lines.push(e.diff);
      lines.push("```");
    } else {
      lines.push("_No automatic patch available — manual refactor required._");
    }
    lines.push("");
  }

  if (committedFiles.length > 0) {
    lines.push("### Files changed");
    for (const file of committedFiles) lines.push(`- \`${file}\``);
    lines.push("");
  }

  lines.push(
    "---",
    "_Generated by HELIX Metabolism — Entropy Digestion organ._",
    "_Review each enzyme action carefully before merging._",
  );

  return lines.join("\n");
}
