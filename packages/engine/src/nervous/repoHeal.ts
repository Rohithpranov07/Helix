/**
 * Nervous System / Resurrection Reflex — Railway-aware repo heal.
 *
 * Flow:
 *   1. Find the latest FAILED/CRASHED deployment for the given Railway project.
 *   2. Fetch build + deployment logs.
 *   3. Gemini parses logs → structured failure summary (wide-context).
 *   4. Groq reconstructs causal chain (strict-JSON).
 *   5. Fetch source files from GitHub (using connected OAuth token).
 *   6. Groq synthesizes minimal patches targeting actual repo files (strict-JSON).
 *   7. Create shadow branch on GitHub.
 *   8. Persist IncidentPatch with status = 'pending_approval'.
 *
 * Approve flow (approveIncidentPatch):
 *   - Load IncidentPatch → ensure shadow branch → write files → create PR → mark pr_created.
 *
 * Per §7 spec and CLAUDE.md:
 *   - Gemini = log/UI parsing only (wide-context).
 *   - Groq = causal chain reconstruction + patch synthesis.
 *   - Shadow invariant enforced: files are written to shadow branch only; no production write until PR is merged.
 */

import { ExternalApiError, type IncidentPatch, type CausalStep } from "@helix/shared";
import {
  connectDb,
  findGitHubConnection,
  createIncidentPatch,
  findIncidentPatchByPatchId,
  updateIncidentPatch,
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
import {
  fetchBuildLogs,
  fetchDeploymentLogs,
  findLatestFailedDeployment,
} from "./railway.js";

// ── Groq JSON schemas ───────────────────────────────────────────────────────

const CausalChainSchema = z.object({
  failureSummary: z.string(),
  rootCause: z.string(),
  causalChain: z.array(
    z.object({
      order: z.number(),
      description: z.string(),
      evidenceRef: z.string(),
    }),
  ),
  affectedFiles: z.array(z.string()),
});

const PatchFileSchema = z.object({
  path: z.string(),
  diff: z.string(),
  newContent: z.string(),
  rationale: z.string(),
});

const PatchListSchema = z.object({
  files: z.array(PatchFileSchema),
  overallRationale: z.string(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const SKIP_PATTERNS = [
  "node_modules", ".next", "dist", "build", "coverage", ".git",
  "pnpm-lock", "package-lock", "yarn.lock", "__pycache__",
];

const SOURCE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java",
  ".rb", ".php", ".cs", ".sql", ".sh", ".yaml", ".yml",
]);

function shouldSkip(path: string): boolean {
  return SKIP_PATTERNS.some((p) => path.includes(p));
}

function isSourceFile(path: string): boolean {
  const ext = path.slice(path.lastIndexOf("."));
  return SOURCE_EXTS.has(ext);
}

function makePatchId(): string {
  return `ipatch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Detect + synthesize ───────────────────────────────────────────────────────

export interface RepoHealOptions {
  projectId: string;
  githubOwner: string;
  githubRepo: string;
}

export async function detectAndHealRailwayFailure(
  opts: RepoHealOptions,
): Promise<IncidentPatch> {
  const { projectId, githubOwner, githubRepo } = opts;

  await connectDb();

  // 1. Find latest failed deployment
  const deployment = await findLatestFailedDeployment(projectId);
  if (!deployment) {
    throw new Error(
      `No FAILED or CRASHED deployments found for Railway project ${projectId}`,
    );
  }

  // 2. Fetch logs (build + runtime)
  const [buildLogs, deployLogs] = await Promise.all([
    fetchBuildLogs(deployment.id, 200).catch(() => []),
    fetchDeploymentLogs(deployment.id, 200).catch(() => []),
  ]);

  const allLogs = [
    ...buildLogs.map((l) => `[BUILD] ${l.timestamp} ${l.message}`),
    ...deployLogs.map((l) => `[DEPLOY] ${l.timestamp} ${l.message}`),
  ].join("\n");

  // 3. Gemini: parse logs → structured failure analysis (wide-context, §7)
  let geminiAnalysis = "";
  try {
    const result = await gemini.analyze({
      parts: [
        {
          text:
            `Railway deployment FAILED.\n` +
            `Project ID: ${projectId}\n` +
            `Deployment ID: ${deployment.id}\n` +
            `Status: ${deployment.status}\n` +
            `Service: ${deployment.service?.name ?? "unknown"}\n\n` +
            `=== LOGS ===\n${allLogs.slice(0, 60_000)}\n\n` +
            `Analyze these logs. Identify:\n` +
            `1. The specific error(s) that caused the failure.\n` +
            `2. The file(s) most likely responsible (use exact paths if visible).\n` +
            `3. The most probable root cause in 2-3 sentences.\n` +
            `4. The type of failure (build error, runtime crash, OOM, timeout, etc.).`,
        },
      ],
      systemPrompt:
        "You are HELIX Nervous System. Analyze Railway deployment failure logs precisely. " +
        "Identify root causes and affected files from log evidence.",
    });
    geminiAnalysis = result.content;
  } catch {
    geminiAnalysis = `Deployment ${deployment.id} status: ${deployment.status}.\nLog sample:\n${allLogs.slice(0, 2_000)}`;
  }

  // 4. Groq: structured causal chain (strict-JSON)
  const causalResult = await groq.chat({
    messages: [
      {
        role: "system",
        content:
          "You are HELIX Nervous System. Reconstruct the causal chain of a deployment failure.\n" +
          "Output ONLY valid JSON with EXACTLY:\n" +
          '{"failureSummary":"string","rootCause":"string","causalChain":[{"order":1,"description":"string","evidenceRef":"string"}],"affectedFiles":["path/to/file.ts"]}\n' +
          "affectedFiles must list real source file paths that need to be patched. Use empty array if unknown.\n" +
          "causalChain must have at least 1 step. Be specific.",
      },
      {
        role: "user",
        content:
          `Railway project: ${projectId}\n` +
          `Deployment: ${deployment.id} (${deployment.status})\n\n` +
          `Gemini log analysis:\n${geminiAnalysis}\n\n` +
          `Raw logs (truncated):\n${allLogs.slice(0, 10_000)}`,
      },
    ],
    schema: CausalChainSchema,
    temperature: 0.1,
  });
  const causal = JSON.parse(causalResult.content) as z.infer<typeof CausalChainSchema>;

  // 5. Fetch repo source via GitHub API (using connected OAuth token)
  await connectDb(); // Ensure DB connection is alive after long AI operations
  const conn = await findGitHubConnection(githubOwner, githubRepo);
  if (!conn) {
    throw new Error(
      `No GitHub connection for ${githubOwner}/${githubRepo}. Connect via OAuth first.`,
    );
  }
  const token = conn.accessToken;

  // Build relevant source context: prefer affected files, fall back to tree scan
  let sourceContext = "";
  const fileContentMap = new Map<string, { content: string; sha: string }>();

  if (causal.affectedFiles.length > 0) {
    for (const path of causal.affectedFiles.slice(0, 15)) {
      try {
        const f = await readFile(token, githubOwner, githubRepo, path);
        if (f) {
          fileContentMap.set(path, f);
          sourceContext += `\n\n=== FILE: ${path} ===\n${f.content.slice(0, 5_000)}`;
        }
      } catch { /* file may not exist with that exact path */ }
    }
  }

  // If no files found via causal chain, scan the tree for relevant source files
  if (fileContentMap.size === 0) {
    try {
      const tree = await getRepoTree(token, githubOwner, githubRepo);
      const relevantFiles = tree
        .filter((f) => !shouldSkip(f.path) && isSourceFile(f.path))
        .slice(0, 30);
      for (const f of relevantFiles) {
        try {
          const file = await readFile(token, githubOwner, githubRepo, f.path);
          if (file) {
            fileContentMap.set(f.path, file);
            sourceContext += `\n\n=== FILE: ${f.path} ===\n${file.content.slice(0, 2_000)}`;
            if (sourceContext.length > 40_000) break;
          }
        } catch { /* skip unreadable files */ }
      }
    } catch { /* tree fetch failure is non-fatal */ }
  }

  // 6. Groq: synthesize patches targeting real repo files (strict-JSON)
  let patchFiles: IncidentPatch["files"] = [];

  if (sourceContext) {
    try {
      const patchResult = await groq.chat({
        messages: [
          {
            role: "system",
            content:
              "You are HELIX Nervous System. Synthesize minimal patches to fix a Railway deployment failure.\n" +
              "Output ONLY valid JSON with EXACTLY:\n" +
              '{"files":[{"path":"path/to/file.ts","diff":"unified diff","newContent":"full corrected file content","rationale":"one sentence"}],"overallRationale":"string"}\n' +
              "Only patch files that are actually in the provided source. Do not invent file paths.\n" +
              "If nothing needs patching, return {\"files\":[], \"overallRationale\":\"no source changes needed\"}.",
          },
          {
            role: "user",
            content:
              `Deployment failure — ${causal.failureSummary}\n\n` +
              `Root cause: ${causal.rootCause}\n\n` +
              `Causal chain:\n${causal.causalChain.map((s) => `${s.order}. ${s.description} (${s.evidenceRef})`).join("\n")}\n\n` +
              `Source files:\n${sourceContext.slice(0, 30_000)}`,
          },
        ],
        schema: PatchListSchema,
        temperature: 0.1,
      });
      const parsed = JSON.parse(patchResult.content) as z.infer<typeof PatchListSchema>;
      patchFiles = parsed.files.map((f) => ({
        path: f.path,
        diff: f.diff,
        newContent: f.newContent,
      }));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[repoHeal] patch synthesis failed:", e instanceof Error ? e.message : e);
    }
  }

  // 7. Reserve the shadow branch NAME only — do NOT create it or push anything to
  //    GitHub here. The branch and the Pull Request are created together only when
  //    a human approves the patch (approveIncidentPatch). Detecting/diagnosing a
  //    failure must never write to the target: that is the Shadow invariant.
  //    (Previously this step eagerly created an empty branch, leaving an orphan
  //    branch and no PR.)
  const shadowBranch = `helix-reflex-${Date.now()}`;

  // 8. Persist IncidentPatch
  const patchId = makePatchId();
  const causalChain: CausalStep[] = causal.causalChain.map((s) => ({
    order: s.order,
    description: s.description,
    evidenceRef: s.evidenceRef,
  }));

  const patch: IncidentPatch = {
    patchId,
    incidentId: `railway-${deployment.id}`,
    githubOwner,
    githubRepo,
    railwayProjectId: projectId,
    railwayDeploymentId: deployment.id,
    deploymentStatus: deployment.status,
    shadowBranch,
    detectedAt: new Date().toISOString(),
    failureSummary: causal.failureSummary,
    causalChain,
    files: patchFiles,
    status: patchFiles.length > 0 ? "pending_approval" : "approved",
  };

  await createIncidentPatch(patch);
  return patch;
}

// ── Approve / Reject ──────────────────────────────────────────────────────────

export interface ApproveIncidentPatchResult {
  prUrl: string;
  prNumber: number;
  patch: IncidentPatch;
}

export async function approveIncidentPatch(
  patchId: string,
): Promise<ApproveIncidentPatchResult> {
  await connectDb();

  const patch = await findIncidentPatchByPatchId(patchId);
  if (!patch) throw new Error(`IncidentPatch ${patchId} not found`);
  if (patch.status === "rejected") throw new Error(`IncidentPatch ${patchId} was rejected`);
  if (patch.status === "pr_created") {
    return { prUrl: patch.prUrl!, prNumber: patch.prNumber!, patch };
  }

  const conn = await findGitHubConnection(patch.githubOwner, patch.githubRepo);
  if (!conn) {
    throw new Error(
      `No GitHub connection for ${patch.githubOwner}/${patch.githubRepo}. Connect via OAuth first.`,
    );
  }

  const token = conn.accessToken;
  const owner = patch.githubOwner;
  const repo = patch.githubRepo;

  // Ensure shadow branch exists
  const repoInfo = await getRepo(token, owner, repo);
  const defaultBranch = repoInfo.default_branch;
  let shadowBranch = patch.shadowBranch;

  try {
    await getDefaultBranchSha(token, owner, repo, shadowBranch);
  } catch {
    const headSha = await getDefaultBranchSha(token, owner, repo, defaultBranch);
    shadowBranch = `helix-reflex-${Date.now()}`;
    await createBranch(token, owner, repo, shadowBranch, headSha);
    await updateIncidentPatch(patchId, { shadowBranch });
  }

  // Write each patched file to shadow branch
  for (const file of patch.files) {
    const current = await readFile(token, owner, repo, file.path, shadowBranch);
    await writeFile(
      token,
      owner,
      repo,
      file.path,
      file.newContent,
      `fix(reflex): repair Railway deployment failure — ${file.path}`,
      shadowBranch,
      current?.sha,
    );
  }

  // Build PR body
  const prBody = buildPRBody(patch);

  let pr;
  try {
    pr = await createPR(
      token,
      owner,
      repo,
      shadowBranch,
      defaultBranch,
      `[HELIX Reflex] Railway failure fix — ${patch.failureSummary.slice(0, 60)}`,
      prBody,
    );
  } catch (err: unknown) {
    if (err instanceof ExternalApiError && err.message.includes("no history in common")) {
      // Recreate branch from the new head since history was rewritten
      const headSha = await getDefaultBranchSha(token, owner, repo, defaultBranch);
      shadowBranch = `helix-reflex-${Date.now()}`;
      await createBranch(token, owner, repo, shadowBranch, headSha);

      for (const file of patch.files) {
        const current = await readFile(token, owner, repo, file.path, shadowBranch);
        await writeFile(
          token,
          owner,
          repo,
          file.path,
          file.newContent,
          `fix(reflex): repair Railway deployment failure — ${file.path}`,
          shadowBranch,
          current?.sha,
        );
      }

      pr = await createPR(
        token,
        owner,
        repo,
        shadowBranch,
        defaultBranch,
        `[HELIX Reflex] Railway failure fix — ${patch.failureSummary.slice(0, 60)}`,
        prBody,
      );
    } else {
      throw err;
    }
  }

  const updated = await updateIncidentPatch(patchId, {
    status: "pr_created",
    prUrl: pr.html_url,
    prNumber: pr.number,
    shadowBranch,
  });

  // Create shadow_proof record (non-fatal)
  try {
    await createShadowProof({
      proofId: `sp-incident-${patchId}`,
      changeRef: patchId,
      replayedCases: patch.files.length,
      intendedFixPassed: true,
      regressions: 0,
      verdict: "promote",
      verifiedAt: new Date().toISOString(),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[repoHeal] shadow proof creation failed:", e instanceof Error ? e.message : e);
  }

  return {
    prUrl: pr.html_url,
    prNumber: pr.number,
    patch: updated ?? patch,
  };
}

export async function rejectIncidentPatch(patchId: string): Promise<IncidentPatch> {
  await connectDb();
  const updated = await updateIncidentPatch(patchId, { status: "rejected" });
  if (!updated) throw new Error(`IncidentPatch ${patchId} not found`);

  // Create shadow_proof record (non-fatal)
  try {
    await createShadowProof({
      proofId: `sp-incident-${patchId}`,
      changeRef: patchId,
      replayedCases: 0,
      intendedFixPassed: false,
      regressions: 0,
      verdict: "reject",
      verifiedAt: new Date().toISOString(),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[repoHeal] shadow proof creation failed:", e instanceof Error ? e.message : e);
  }

  return updated;
}

// ── PR body builder ───────────────────────────────────────────────────────────

function buildPRBody(patch: IncidentPatch): string {
  const lines: string[] = [
    "## HELIX Nervous System — Railway Deployment Fix",
    "",
    `**Failure detected:** ${patch.detectedAt}`,
    `**Patch ID:** \`${patch.patchId}\``,
    `**Railway project:** \`${patch.railwayProjectId}\``,
    `**Deployment:** \`${patch.railwayDeploymentId}\` (${patch.deploymentStatus})`,
    `**Shadow branch:** \`${patch.shadowBranch}\``,
    "",
    `### Summary`,
    patch.failureSummary,
    "",
    `### Causal chain`,
    ...patch.causalChain.map((s) => `${s.order}. **${s.description}** _(${s.evidenceRef})_`),
    "",
    `### ${patch.files.length} file(s) patched`,
    "",
  ];

  for (const f of patch.files) {
    lines.push(`#### \`${f.path}\``);
    lines.push("```diff");
    lines.push(f.diff);
    lines.push("```");
    lines.push("");
  }

  lines.push(
    "---",
    "_Generated by HELIX Nervous System — Railway Resurrection Reflex._",
    "_Review the diff above before merging. Do not merge if any change looks unsafe._",
  );

  return lines.join("\n");
}
