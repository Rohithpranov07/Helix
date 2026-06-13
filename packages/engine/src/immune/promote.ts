/**
 * T5.2 — Real-target promoter
 *
 * promoteToTarget: applies a Shadow-proven patch to the REAL apps/target/
 *   source tree by running `patch -p1` from the repo root.
 *
 * This is the last step of the immune heal loop and the ONLY place in HELIX
 * that deliberately writes to the real target. It is gated behind:
 *   1. assertPatchSafe (re-run here for defence-in-depth)
 *   2. The PROMOTION GATE in healVulnerability (verdict:'promote' required)
 *   3. A persisted shadow_proof record (written by verifyEquivalence)
 *
 * The Shadow invariant is therefore triply enforced:
 *   - no real-target write without a shadow_proof
 *   - no shadow_proof without a successful equivalence check
 *   - no call to promoteToTarget without passing through all three guards
 *
 * Audit trail: each promotion writes diffs to shadow/staging/promote-<ts>/
 * alongside the existing per-changeRef staging directories.
 */
import { spawnSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { ValidationError, type Vulnerability } from "@helix/shared";
import type { HelixDoc } from "@helix/db";
import { assertPatchSafe } from "./patch.js";
import type { Patch } from "./patch.js";

// ── Constants ─────────────────────────────────────────────────────────────────

// From packages/engine/src/immune/ → repo root is 4 levels up.
const REPO_ROOT = resolve(__dirname, "../../../..");
const SHADOW_STAGING = resolve(REPO_ROOT, "shadow/staging");

// ── promoteToTarget ───────────────────────────────────────────────────────────

/**
 * Applies a proven patch to the real apps/target/ source tree.
 *
 * Called by healVulnerability ONLY after:
 *   - A shadow_proof with verdict:'promote' is in hand
 *   - The promotion gate has passed (assertPromotable)
 *
 * Never call this directly — always go through healVulnerability so the
 * Shadow invariant and all guards are preserved.
 */
export async function promoteToTarget(
  finding: HelixDoc<Vulnerability>,
  patch: Patch,
): Promise<void> {
  // Defence-in-depth: re-check the patch is within bounds even though
  // applyInShadow already checked before the Shadow proof was obtained.
  assertPatchSafe(patch);

  const promoRef = `promote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const stagingDir = resolve(SHADOW_STAGING, promoRef);
  mkdirSync(stagingDir, { recursive: true });

  for (let i = 0; i < patch.files.length; i++) {
    const file = patch.files[i];
    if (!file) continue;

    // Write the diff to the audit trail.
    const diffFile = resolve(stagingDir, `${i}.patch`);
    writeFileSync(diffFile, file.diff, "utf8");

    // Apply to the REAL target from REPO_ROOT.
    // The unified diff has a/ and b/ prefixes; -p1 strips them, leaving
    // `apps/target/src/...` relative to REPO_ROOT — exactly the right path.
    const result = spawnSync(
      "patch",
      ["-p1", "--no-backup-if-mismatch", "-i", diffFile],
      { cwd: REPO_ROOT, encoding: "utf8", timeout: 15_000 },
    );

    if (result.status !== 0) {
      throw new ValidationError(
        `promoteToTarget: patch command failed for ${file.path}:\n` +
          (result.stdout ?? "") + (result.stderr ?? ""),
        { findingId: finding._id, file: file.path, promoRef },
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[promote] ${finding.class}@${finding.endpoint} → real target ` +
      `(${patch.files.length} file(s), ref:${promoRef})`,
  );
}
