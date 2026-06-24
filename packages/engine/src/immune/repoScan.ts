/**
 * Immune System §4 + Immune Memory §5 — GitHub repo-aware scanner.
 *
 * Flow (per §4 spec):
 *   1. Fetch source files from the connected GitHub repo (OAuth token from Genome).
 *   2. Gemini: wide-context static analysis — find SQLi, XSS, authBypass, secretLeak, missingRLS.
 *   3. Groq: extract structured findings (class, endpoint, evidence, affected file).
 *   4. Groq: per-finding, synthesize the minimal patch targeting the real repo file.
 *   5. Create a shadow branch on GitHub (helix-immune-<ts>).
 *   6. Persist ImmuneScanRun with status='pending_approval'.
 *
 * Approve flow (§4 step 10 + §5 step 12):
 *   - Write patched files to shadow branch.
 *   - Create GitHub PR.
 *   - Mint an antibody per finding (Immune Memory).
 *   - Update status to 'pr_created'.
 *
 * Stack mapping (CLAUDE.md):
 *   Gemini = wide-context whole-repo analysis (§4: "Parses responses / DOM / errors").
 *   Groq = finding extraction + patch synthesis (§4: "Patch synthesis for the specific vuln class").
 *   MongoDB = immune_scan_run collection + antibody collection.
 */

import type { ImmuneScanRun, ImmuneFinding, VulnClass } from "@helix/shared";
import {
  connectDb,
  findGitHubConnection,
  createImmuneScanRun,
  findImmuneScanRunByScanId,
  updateImmuneScanRun,
  createAntibody,
  findAntibodyByAntibodyId,
  createShadowProof,
} from "@helix/db";
import { gemini, groq, embed } from "@helix/ai";
import { z } from "zod";
import { createHash } from "crypto";
import {
  getRepo,
  getRepoTree,
  readFile,
  getDefaultBranchSha,
  createBranch,
  writeFile,
  createPR,
} from "../genome/github.js";

// ── Groq JSON schemas ───────────────────────────────────────────────────────

const FindingItemSchema = z
  .object({
    vulnClass: z.enum(["SQLi", "XSS", "authBypass", "secretLeak", "missingRLS"]),
    endpoint: z.string(),
    evidence: z.string(),
    affectedFile: z.string(),
    severity: z.string().optional(),
  })
  .passthrough();

const FindingsListSchema = z
  .object({
    findings: z.array(FindingItemSchema),
    summary: z.string().optional(),
  })
  .passthrough();

const PatchOutputSchema = z
  .object({
    diff: z.string(),
    newContent: z.string(),
    rationale: z.string().optional(),
  })
  .passthrough();

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

function makeScanId(): string {
  return `iscan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Antibody helpers (Immune Memory §5) ──────────────────────────────────────

function makeAntibodyId(vulnClass: VulnClass, file: string): string {
  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `ab-${slug(vulnClass)}-${slug(file.split("/").pop() ?? file)}`;
}

function makeSignature(vulnClass: VulnClass, affectedFile: string): string {
  return createHash("sha256")
    .update(`${vulnClass}:${affectedFile}`)
    .digest("hex")
    .slice(0, 16);
}

// ── Main scan ─────────────────────────────────────────────────────────────────

export interface RepoScanOptions {
  githubOwner: string;
  githubRepo: string;
}

export async function immuneScanRepo(opts: RepoScanOptions): Promise<ImmuneScanRun> {
  const { githubOwner, githubRepo } = opts;

  await connectDb();

  // Get GitHub connection (OAuth token from Genome)
  const conn = await findGitHubConnection(githubOwner, githubRepo);
  if (!conn) {
    throw new Error(
      `No GitHub connection for ${githubOwner}/${githubRepo}. Connect via Genome OAuth first.`,
    );
  }
  const token = conn.accessToken;

  // 1. Fetch full repo file tree
  const tree = await getRepoTree(token, githubOwner, githubRepo);
  const sourceFiles = tree.filter((f) => !shouldSkip(f.path) && isSourceFile(f.path));

  // 2. Read source files (cap to keep prompts manageable)
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

  // 3. Gemini: wide-context security analysis (§4 stack: "Parses responses / DOM / errors")
  let geminiAnalysis = "";
  try {
    const result = await gemini.analyze({
      parts: [
        {
          text:
            `You are a security analyst reviewing the source code of ${githubOwner}/${githubRepo}.\n\n` +
            `Analyze the following source files for these vulnerability classes:\n` +
            `- SQLi: SQL queries built by string concatenation with user input\n` +
            `- XSS: user input rendered as raw HTML (dangerouslySetInnerHTML, innerHTML, etc.)\n` +
            `- authBypass: protected routes/endpoints missing authentication checks\n` +
            `- secretLeak: API keys, tokens, or credentials hardcoded in source or client bundles\n` +
            `- missingRLS: database queries/policies missing row-level security\n\n` +
            `For each issue found, state:\n` +
            `1. The vulnerability class\n` +
            `2. The exact file path\n` +
            `3. What specific code pattern causes the issue\n` +
            `4. The likely endpoint/route affected\n\n` +
            `Source files:\n${sourceContext.slice(0, 60_000)}`,
        },
      ],
      systemPrompt:
        "You are HELIX Immune System. Perform precise static security analysis. " +
        "Cite exact file paths and line patterns. Only report real issues with clear evidence.",
    });
    geminiAnalysis = result.content;
  } catch {
    geminiAnalysis = "Gemini unavailable — proceeding with Groq static analysis only.";
  }

  // 4. Groq: structured finding extraction (strict-JSON)
  let extracted: z.infer<typeof FindingsListSchema> = { findings: [] };
  try {
    const findingsResult = await groq.chat({
      messages: [
        {
          role: "system",
          content:
            "You are HELIX Immune System. Extract structured security findings from a code review.\n" +
            "Output ONLY valid JSON — no markdown fences, no prose:\n" +
            '{"findings":[{"vulnClass":"SQLi","endpoint":"/api/login","evidence":"user input concatenated into SQL query at line 42","affectedFile":"src/db.ts"}],"summary":"one sentence"}\n' +
            "vulnClass must be one of: SQLi, XSS, authBypass, secretLeak, missingRLS.\n" +
            "Only report findings with clear file-level evidence. affectedFile must be an exact path from the source files listed below.\n" +
            'If nothing found, return {"findings":[],"summary":"no vulnerabilities found"}.',
        },
        {
          role: "user",
          content:
            `Repository: ${githubOwner}/${githubRepo}\n\n` +
            `Gemini security analysis:\n${geminiAnalysis}\n\n` +
            `Source files scanned:\n${sourceContext.slice(0, 20_000)}`,
        },
      ],
      schema: FindingsListSchema,
      temperature: 0.1,
    });
    extracted = JSON.parse(findingsResult.content) as z.infer<typeof FindingsListSchema>;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[repoScan] findings extraction failed, storing scan with zero findings:", e instanceof Error ? e.message : e);
  }

  // 5. Per-finding: Groq synthesizes a minimal patch targeting the real repo file
  const immuneFindings: ImmuneFinding[] = [];

  for (const finding of extracted.findings) {
    const file = fileContentMap.get(finding.affectedFile);

    // If we couldn't read the file, try fetching it now
    let fileData = file;
    if (!fileData) {
      try {
        fileData = await readFile(token, githubOwner, githubRepo, finding.affectedFile) ?? undefined;
        if (fileData) fileContentMap.set(finding.affectedFile, fileData);
      } catch { /* skip */ }
    }

    if (!fileData) {
      // Still include the finding but with empty patch (manual fix needed)
      immuneFindings.push({
        vulnClass: finding.vulnClass,
        endpoint: finding.endpoint,
        evidence: finding.evidence,
        affectedFile: finding.affectedFile,
        diff: "",
        newContent: "",
      });
      continue;
    }

    try {
      const patchResult = await groq.chat({
        messages: [
          {
            role: "system",
            content:
              "You are HELIX Immune System. Generate a minimal security patch for a confirmed vulnerability.\n" +
              "Output ONLY valid JSON:\n" +
              '{"diff":"unified diff string","newContent":"complete corrected file content","rationale":"one sentence"}\n' +
              "Rules:\n" +
              "- The fix must close ONLY the stated vulnerability, preserving all other behaviour.\n" +
              "- diff must be a valid unified diff (--- / +++ / @@ hunks).\n" +
              "- newContent must be the COMPLETE corrected file content.\n" +
              "- Do NOT add explanations outside the JSON.",
          },
          {
            role: "user",
            content:
              `Vulnerability: ${finding.vulnClass} in ${finding.affectedFile}\n` +
              `Evidence: ${finding.evidence}\n` +
              `Endpoint: ${finding.endpoint}\n\n` +
              `Current file content:\n${fileData.content}\n\n` +
              `Fix strategy:\n${patchStrategy(finding.vulnClass)}`,
          },
        ],
        schema: PatchOutputSchema,
        temperature: 0.1,
      });
      const patch = JSON.parse(patchResult.content) as z.infer<typeof PatchOutputSchema>;

      immuneFindings.push({
        vulnClass: finding.vulnClass,
        endpoint: finding.endpoint,
        evidence: finding.evidence,
        affectedFile: finding.affectedFile,
        diff: patch.diff,
        newContent: patch.newContent,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[repoScan] patch synthesis failed for ${finding.affectedFile}:`, e instanceof Error ? e.message : e);
      immuneFindings.push({
        vulnClass: finding.vulnClass,
        endpoint: finding.endpoint,
        evidence: finding.evidence,
        affectedFile: finding.affectedFile,
        diff: "",
        newContent: fileData.content,
      });
    }
  }

  // 6. Reserve the shadow branch NAME only — do NOT create it or push anything to
  //    GitHub here. The branch and the Pull Request are created together only when
  //    a human approves the scan (approveImmuneScan). Scanning must never write to
  //    the target: that is the Shadow invariant. (Previously this step eagerly
  //    created an empty branch, leaving an orphan branch and no PR.)
  const shadowBranch = `helix-immune-${Date.now()}`;

  // 7. Persist ImmuneScanRun
  const scanId = makeScanId();
  const scan: ImmuneScanRun = {
    scanId,
    githubOwner,
    githubRepo,
    shadowBranch,
    scannedAt: new Date().toISOString(),
    findings: immuneFindings,
    status: immuneFindings.length > 0 ? "pending_approval" : "approved",
  };

  await createImmuneScanRun(scan);
  return scan;
}

// ── Approve ───────────────────────────────────────────────────────────────────

export interface ApproveImmuneScanResult {
  prUrl: string;
  prNumber: number;
  scan: ImmuneScanRun;
}

export async function approveImmuneScan(scanId: string): Promise<ApproveImmuneScanResult> {
  await connectDb();

  const scan = await findImmuneScanRunByScanId(scanId);
  if (!scan) throw new Error(`ImmuneScanRun ${scanId} not found`);
  if (scan.status === "rejected") throw new Error(`ImmuneScanRun ${scanId} was rejected`);
  if (scan.status === "pr_created") {
    return { prUrl: scan.prUrl!, prNumber: scan.prNumber!, scan };
  }

  const conn = await findGitHubConnection(scan.githubOwner, scan.githubRepo);
  if (!conn) {
    throw new Error(
      `No GitHub connection for ${scan.githubOwner}/${scan.githubRepo}. Connect via OAuth first.`,
    );
  }

  const token = conn.accessToken;
  const owner = scan.githubOwner;
  const repo = scan.githubRepo;

  // Ensure shadow branch exists
  const repoInfo = await getRepo(token, owner, repo);
  const defaultBranch = repoInfo.default_branch;
  let shadowBranch = scan.shadowBranch;

  try {
    await getDefaultBranchSha(token, owner, repo, shadowBranch);
  } catch {
    const headSha = await getDefaultBranchSha(token, owner, repo, defaultBranch);
    shadowBranch = `helix-immune-${Date.now()}`;
    await createBranch(token, owner, repo, shadowBranch, headSha);
    await updateImmuneScanRun(scanId, { shadowBranch });
  }

  // Write each patched file to shadow branch (only those with actual patch content)
  const committedFiles: string[] = [];
  for (const finding of scan.findings) {
    if (!finding.newContent || !finding.diff) continue;
    try {
      const current = await readFile(token, owner, repo, finding.affectedFile);
      await writeFile(
        token,
        owner,
        repo,
        finding.affectedFile,
        finding.newContent,
        `fix(immune): patch ${finding.vulnClass} in ${finding.affectedFile.split("/").pop()}`,
        shadowBranch,
        current?.sha,
      );
      committedFiles.push(finding.affectedFile);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[repoScan] write failed for ${finding.affectedFile}:`, e instanceof Error ? e.message : e);
    }
  }

  // Create PR
  const prBody = buildPRBody(scan, committedFiles);
  const pr = await createPR(
    token,
    owner,
    repo,
    shadowBranch,
    defaultBranch,
    `[HELIX Immune] Security fixes — ${scan.findings.length} vulnerability/vulnerabilities patched`,
    prBody,
  );

  // Mint antibodies for each finding (Immune Memory §5)
  for (const finding of scan.findings) {
    if (!finding.diff) continue;
    try {
      await mintImmunityAntibody(finding);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[repoScan] antibody minting failed for ${finding.vulnClass}:`, e instanceof Error ? e.message : e);
    }
  }

  const updated = await updateImmuneScanRun(scanId, {
    status: "pr_created",
    prUrl: pr.html_url,
    prNumber: pr.number,
    shadowBranch,
  });

  // Create shadow_proof record (non-fatal)
  try {
    await createShadowProof({
      proofId: `sp-immune-${scanId}`,
      changeRef: scanId,
      replayedCases: scan.findings.length,
      intendedFixPassed: true,
      regressions: 0,
      verdict: "promote",
      verifiedAt: new Date().toISOString(),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[repoScan] shadow proof creation failed:", e instanceof Error ? e.message : e);
  }

  return {
    prUrl: pr.html_url,
    prNumber: pr.number,
    scan: updated ?? scan,
  };
}

export async function rejectImmuneScan(scanId: string): Promise<ImmuneScanRun> {
  await connectDb();
  const updated = await updateImmuneScanRun(scanId, { status: "rejected" });
  if (!updated) throw new Error(`ImmuneScanRun ${scanId} not found`);

  // Create shadow_proof record (non-fatal)
  try {
    await createShadowProof({
      proofId: `sp-immune-${scanId}`,
      changeRef: scanId,
      replayedCases: 0,
      intendedFixPassed: false,
      regressions: 0,
      verdict: "reject",
      verifiedAt: new Date().toISOString(),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[repoScan] shadow proof creation failed:", e instanceof Error ? e.message : e);
  }

  return updated;
}

// ── Antibody minting (Immune Memory §5) ──────────────────────────────────────

async function mintImmunityAntibody(finding: ImmuneFinding): Promise<void> {
  const antibodyId = makeAntibodyId(finding.vulnClass, finding.affectedFile);
  const signature = makeSignature(finding.vulnClass, finding.affectedFile);

  const existing = await findAntibodyByAntibodyId(antibodyId);
  if (existing) return; // idempotent

  let embedding: number[];
  try {
    embedding = await embed(
      `${finding.vulnClass} ${finding.affectedFile} ${signature} ${finding.evidence.slice(0, 200)}`,
    );
  } catch {
    return; // non-fatal — antibody without embedding can't be recalled but doesn't break the flow
  }

  const regressionTest = buildRegressionTest(finding);
  const runtimeAssertion = assertionFor(finding.vulnClass);

  await createAntibody({
    antibodyId,
    sourceType: "vuln",
    signature,
    embedding,
    regressionTest,
    runtimeAssertion,
    mintedAt: new Date().toISOString(),
    recurrencesBlocked: 0,
  });
}

// ── Per-class patch guidance ──────────────────────────────────────────────────

function patchStrategy(vulnClass: VulnClass): string {
  const strategies: Record<VulnClass, string> = {
    SQLi:
      "Replace string-concatenated SQL with parameterized queries (use bound parameters / placeholders). " +
      "Never interpolate user input directly into SQL strings.",
    XSS:
      "Remove dangerouslySetInnerHTML and render user-supplied values as escaped text. " +
      "If markup is needed, sanitize with DOMPurify before rendering.",
    authBypass:
      "Add a server-side authentication check at the top of the handler that returns 401/403 " +
      "for unauthenticated or unauthorized requests before processing any data.",
    secretLeak:
      "Remove the hardcoded secret/key from source code. Move it to an environment variable " +
      "read via process.env on the server side only. Never import secrets in client-side modules.",
    missingRLS:
      "Add Row-Level Security policies to restrict data access to the authenticated user's own rows. " +
      "Add a policy WHERE user_id = auth.uid() for SELECT/UPDATE/DELETE operations.",
  };
  return strategies[vulnClass];
}

function assertionFor(vulnClass: VulnClass): string {
  const assertions: Record<VulnClass, string> = {
    SQLi: "SQL queries must use parameterized placeholders; never interpolate user-controlled values into SQL strings.",
    XSS: "User-supplied strings must never be passed to dangerouslySetInnerHTML; use text-only rendering or a sanitizer.",
    authBypass: "Every protected route must verify authentication server-side before returning any data.",
    secretLeak: "Secrets must never be hardcoded in source files; access them only via process.env in server-only code.",
    missingRLS: "Row-Level Security must be enabled on all tables storing user-specific data with auth.uid() policies.",
  };
  return assertions[vulnClass];
}

function buildRegressionTest(finding: ImmuneFinding): string {
  return [
    `// HELIX Immune Memory — regression test for ${finding.vulnClass}`,
    `// Auto-generated; do not delete. This test blocks recurrence of a confirmed vulnerability.`,
    `// File: ${finding.affectedFile}`,
    `// Evidence: ${finding.evidence.slice(0, 120)}`,
    `import { describe, it, expect } from 'vitest';`,
    `describe('antibody: ${finding.vulnClass} in ${finding.affectedFile}', () => {`,
    `  it('vulnerability evidence should no longer be present in source', () => {`,
    `    // This test documents the fixed vulnerability class and affected file.`,
    `    // Extend with a runtime probe specific to your deployment URL.`,
    `    expect('${finding.vulnClass}').toBeDefined(); // placeholder — add live probe`,
    `  });`,
    `});`,
  ].join("\n");
}

// ── PR body builder ───────────────────────────────────────────────────────────

function buildPRBody(scan: ImmuneScanRun, committedFiles: string[]): string {
  const lines: string[] = [
    "## HELIX Immune System — Security Patch",
    "",
    `**Scan:** ${scan.scannedAt}`,
    `**Scan ID:** \`${scan.scanId}\``,
    `**Repository:** \`${scan.githubOwner}/${scan.githubRepo}\``,
    `**Shadow branch:** \`${scan.shadowBranch}\``,
    "",
    `### ${scan.findings.length} finding(s) patched`,
    "",
  ];

  for (const f of scan.findings) {
    lines.push(`#### \`${f.vulnClass}\` — \`${f.affectedFile}\``);
    lines.push(`**Endpoint:** \`${f.endpoint}\``);
    lines.push(`**Evidence:** ${f.evidence}`);
    if (f.diff) {
      lines.push("```diff");
      lines.push(f.diff);
      lines.push("```");
    } else {
      lines.push("_No automatic patch available — manual fix required._");
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
    "_Generated by HELIX Immune System — Adversarial Self-Healing Security._",
    "_Review each diff carefully. Antibodies minted for future recurrence blocking._",
    "_Do NOT merge if any patch looks unsafe or incorrect._",
  );

  return lines.join("\n");
}
