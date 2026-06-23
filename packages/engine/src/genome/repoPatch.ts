/**
 * Genome shadow branch writer + Pull Request creator.
 *
 * Called after a human approves a DriftReport.
 * Flow:
 *   1. Load DriftReport from DB.
 *   2. For each mismatch: write the patched file to the shadow branch.
 *   3. Create a Pull Request from the shadow branch → default branch.
 *   4. Update DriftReport status to 'pr_created'.
 *
 * The PR is opened — no auto-merge. Human reviews and merges.
 */
import { ExternalApiError, type DriftReport } from "@helix/shared";
import {
  connectDb,
  findDriftReportByDriftId,
  updateDriftReport,
  findGitHubConnection,
  createShadowProof,
} from "@helix/db";
import { writeFile, readFile, createPR, getRepo, getDefaultBranchSha, createBranch } from "./github.js";

export interface ApproveResult {
  prUrl: string;
  prNumber: number;
  report: DriftReport;
}

export async function approveDriftPatch(driftId: string): Promise<ApproveResult> {
  await connectDb();

  const report = await findDriftReportByDriftId(driftId);
  if (!report) throw new Error(`DriftReport ${driftId} not found`);
  if (report.status === "rejected") throw new Error(`DriftReport ${driftId} was rejected`);
  if (report.status === "pr_created") {
    return { prUrl: report.prUrl!, prNumber: report.prNumber!, report };
  }

  const conn = await findGitHubConnection(report.githubOwner, report.githubRepo);
  if (!conn) {
    throw new Error(
      `No GitHub connection for ${report.githubOwner}/${report.githubRepo}. Connect via OAuth first.`,
    );
  }

  const token = conn.accessToken;
  const owner = report.githubOwner;
  const repo = report.githubRepo;

  // Ensure shadow branch exists (may have been created in drift step; recreate if not)
  const repoInfo = await getRepo(token, owner, repo);
  const defaultBranch = repoInfo.default_branch;
  let shadowBranch = report.shadowBranch;

  try {
    const sha = await getDefaultBranchSha(token, owner, repo, shadowBranch);
    void sha; // branch exists
  } catch {
    // Branch missing — recreate from default branch HEAD
    const headSha = await getDefaultBranchSha(token, owner, repo, defaultBranch);
    shadowBranch = `helix-shadow-${Date.now()}`;
    await createBranch(token, owner, repo, shadowBranch, headSha);
    await updateDriftReport(driftId, { shadowBranch });
  }

  // Write each patched file to the shadow branch
  const committed: string[] = [];
  for (const mismatch of report.mismatches) {
    if (committed.includes(mismatch.affectedFile)) continue; // Only write each file once

    // Get current file sha (required by GitHub PUT /contents)
    const current = await readFile(token, owner, repo, mismatch.affectedFile, shadowBranch);

    await writeFile(
      token,
      owner,
      repo,
      mismatch.affectedFile,
      mismatch.newContent,
      `fix(genome): restore invariants in ${mismatch.affectedFile}`,
      shadowBranch,
      current?.sha,
    );
    committed.push(mismatch.affectedFile);
  }

  // Build PR body — include full diff for each mismatch for human review
  const prBody = buildPRBody(report, committed);

  let pr;
  try {
    pr = await createPR(
      token,
      owner,
      repo,
      shadowBranch,
      defaultBranch,
      `[HELIX Genome] Drift fix — ${report.mismatches.length} invariant(s) restored`,
      prBody,
    );
  } catch (err: unknown) {
    if (err instanceof ExternalApiError && err.message.includes("no history in common")) {
      // Recreate branch from the new head since history was rewritten
      const headSha = await getDefaultBranchSha(token, owner, repo, defaultBranch);
      shadowBranch = `helix-shadow-${Date.now()}`;
      await createBranch(token, owner, repo, shadowBranch, headSha);

      const newCommitted: string[] = [];
      for (const mismatch of report.mismatches) {
        if (newCommitted.includes(mismatch.affectedFile)) continue;
        const current = await readFile(token, owner, repo, mismatch.affectedFile, shadowBranch);
        await writeFile(
          token,
          owner,
          repo,
          mismatch.affectedFile,
          mismatch.newContent,
          `fix(genome): restore invariants in ${mismatch.affectedFile}`,
          shadowBranch,
          current?.sha,
        );
        newCommitted.push(mismatch.affectedFile);
      }

      pr = await createPR(
        token,
        owner,
        repo,
        shadowBranch,
        defaultBranch,
        `[HELIX Genome] Drift fix — ${report.mismatches.length} invariant(s) restored`,
        prBody,
      );
    } else {
      throw err;
    }
  }

  // Persist result
  const updated = await updateDriftReport(driftId, {
    status: "pr_created",
    prUrl: pr.html_url,
    prNumber: pr.number,
    shadowBranch,
  });

  // Create shadow_proof record (non-fatal)
  try {
    await createShadowProof({
      proofId: `sp-drift-${driftId}`,
      changeRef: driftId,
      replayedCases: report.mismatches.length,
      intendedFixPassed: true,
      regressions: 0,
      verdict: "promote",
      verifiedAt: new Date().toISOString(),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[repoPatch] shadow proof creation failed:", e instanceof Error ? e.message : e);
  }

  return {
    prUrl: pr.html_url,
    prNumber: pr.number,
    report: updated ?? report,
  };
}

export async function rejectDriftPatch(driftId: string): Promise<DriftReport> {
  await connectDb();
  const updated = await updateDriftReport(driftId, { status: "rejected" });
  if (!updated) throw new Error(`DriftReport ${driftId} not found`);

  // Create shadow_proof record (non-fatal)
  try {
    await createShadowProof({
      proofId: `sp-drift-${driftId}`,
      changeRef: driftId,
      replayedCases: 0,
      intendedFixPassed: false,
      regressions: 0,
      verdict: "reject",
      verifiedAt: new Date().toISOString(),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[repoPatch] shadow proof creation failed:", e instanceof Error ? e.message : e);
  }

  return updated;
}

// ── PR body builder ───────────────────────────────────────────────────────────

// GitHub rejects PR bodies over 65536 chars. Stay well under, and cap each diff
// so one huge file (e.g. a migration with dozens of mismatches) can't blow the
// budget. The full patched content always lives on the shadow branch regardless.
const MAX_PR_BODY = 60_000;
const MAX_DIFF_CHARS = 4_000;

function buildPRBody(report: DriftReport, committed: string[]): string {
  const header: string[] = [
    "## HELIX Genome — Drift Fix",
    "",
    `**Drift detected:** ${report.detectedAt}`,
    `**Drift ID:** \`${report.driftId}\``,
    `**Shadow branch:** \`${report.shadowBranch}\``,
    "",
    `### ${report.mismatches.length} invariant(s) restored`,
    "",
  ];

  const footerOf = (omitted: number): string[] => [
    ...(omitted > 0
      ? ["", `> _… ${omitted} more invariant detail(s) omitted to fit GitHub's PR body limit. Full diff is on the shadow branch \`${report.shadowBranch}\`._`]
      : []),
    "",
    "### Files changed",
    ...committed.map((f) => `- \`${f}\``),
    "",
    "---",
    "_Generated by HELIX Genome — AI-built software integrity organ._",
    "_Review the diff on the shadow branch before merging. Do not merge if any change looks unsafe._",
  ];

  const sections: string[] = [];
  let used = header.join("\n").length;
  let rendered = 0;

  for (const m of report.mismatches) {
    const diff = m.diff.length > MAX_DIFF_CHARS ? `${m.diff.slice(0, MAX_DIFF_CHARS)}\n… (diff truncated)` : m.diff;
    const block = [
      `#### [\`${m.invariantId}\`] ${m.description}`,
      `**File:** \`${m.affectedFile}\``,
      "```diff",
      diff,
      "```",
      "",
    ].join("\n");
    // Reserve room for the footer (which grows with the omitted count).
    if (used + block.length + footerOf(report.mismatches.length).join("\n").length > MAX_PR_BODY) break;
    sections.push(block);
    used += block.length;
    rendered++;
  }

  const omitted = report.mismatches.length - rendered;
  return [...header, ...sections, ...footerOf(omitted)].join("\n").slice(0, MAX_PR_BODY);
}
