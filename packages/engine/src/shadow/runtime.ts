/**
 * T4.1 — Shadow twin runtime
 *
 * spinShadow:     ensures shadow/workspace/ is populated from the real target source,
 *                 then starts the helix-shadow Docker container. Idempotent.
 *
 * applyToShadow:  receives a Groq-synthesised Patch, writes each unified diff into
 *                 shadow/workspace/ using the system `patch` command, so the running
 *                 shadow container sees the change immediately via the volume mount.
 *                 THE REAL apps/target/ IS NEVER TOUCHED — Shadow invariant.
 *
 * replayTraffic:  fans a list of HTTP cases to BOTH the real target and the shadow
 *                 in parallel, returns paired results for T4.2 equivalence check.
 *
 * Docker compose file: shadow/docker-compose.yml
 * Shadow URL: http://localhost:3002
 * Real target: http://localhost:3001
 */
import { spawnSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  cpSync,
} from "fs";
import { resolve, dirname } from "path";
import { ValidationError } from "@helix/shared";
import { assertPatchSafe } from "../immune/patch.js";
import type { Patch, ShadowApplyResult } from "../immune/patch.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(__dirname, "../../../..");
export const SHADOW_URL = "http://localhost:3002";
export const TARGET_URL = "http://localhost:3001";

/** Host-side copy of target source patched by applyToShadow. Volume-mounted into container. */
export const SHADOW_WORKSPACE = resolve(REPO_ROOT, "shadow/workspace");
/** Audit trail: one sub-dir per patchRef containing the applied diffs. */
const SHADOW_STAGING = resolve(REPO_ROOT, "shadow/staging");
const SHADOW_COMPOSE_FILE = resolve(REPO_ROOT, "shadow/docker-compose.yml");

// ── Workspace path helpers ────────────────────────────────────────────────────

/**
 * Maps a repo-root-relative patch file path to its shadow workspace location.
 *
 * "apps/target/src/app/api/products/search/route.ts"
 *   →  "<SHADOW_WORKSPACE>/apps/target/src/app/api/products/search/route.ts"
 *
 * Both the `patch` command (run with cwd=SHADOW_WORKSPACE and -p1) and the
 * Docker volume mount (./workspace/apps/target/src → /app/src) expect this layout.
 */
function toWorkspacePath(filePath: string): string {
  return resolve(SHADOW_WORKSPACE, filePath);
}

// ── Health check ──────────────────────────────────────────────────────────────

async function waitForHealth(url: string, maxMs = 60_000): Promise<void> {
  const interval = 2_000;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/`);
      if (res.status < 500) return;
    } catch {
      // Container not ready yet — keep polling.
    }
    await new Promise<void>((res) => setTimeout(res, interval));
  }
  throw new ValidationError(
    `Shadow did not become healthy within ${maxMs / 1000}s at ${url}. ` +
      "Check: docker logs helix-shadow",
  );
}

// ── spinShadow ────────────────────────────────────────────────────────────────

/**
 * Ensures the shadow workspace exists (populates from real target on first run)
 * then starts the shadow Docker container. Idempotent — safe to call repeatedly.
 *
 * Requires Docker + Docker Compose to be installed on the host.
 */
export async function spinShadow(
  opts: { shadowUrl?: string } = {},
): Promise<{ shadowUrl: string }> {
  const shadowUrl = opts.shadowUrl ?? SHADOW_URL;

  // Populate workspace from real target source on first use.
  const workspaceSrc = resolve(SHADOW_WORKSPACE, "apps/target/src");
  if (!existsSync(workspaceSrc)) {
    cpSync(resolve(REPO_ROOT, "apps/target/src"), workspaceSrc, { recursive: true });
  }

  // Start (or restart-idempotently) the shadow container.
  const up = spawnSync(
    "docker",
    ["compose", "-f", SHADOW_COMPOSE_FILE, "up", "-d", "--build"],
    { encoding: "utf8", timeout: 120_000 },
  );

  if (up.status !== 0) {
    throw new ValidationError(
      `spinShadow: docker compose up failed:\n${up.stderr ?? up.stdout}`,
    );
  }

  await waitForHealth(shadowUrl);
  return { shadowUrl };
}

// ── applyToShadow ─────────────────────────────────────────────────────────────

/**
 * Applies a Groq-synthesised patch to the shadow workspace ONLY.
 *
 * For each file in the patch:
 *   1. Ensures the file exists in shadow/workspace/ (copies from real target if missing).
 *   2. Writes the unified diff to shadow/staging/<patchRef>/<N>.patch for audit.
 *   3. Runs `patch -p1 -i <diffFile>` from the SHADOW_WORKSPACE root so the shadow
 *      container hot-reloads the updated file via the volume mount.
 *
 * THE REAL apps/target/ IS NEVER WRITTEN. Guardrail: assertPatchSafe fires before
 * any file I/O (defence in depth on top of the check in applyInShadow).
 */
export async function applyToShadow(patch: Patch): Promise<ShadowApplyResult> {
  assertPatchSafe(patch); // defence-in-depth

  const patchRef = `shadow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const stagingDir = resolve(SHADOW_STAGING, patchRef);
  mkdirSync(stagingDir, { recursive: true });

  for (let i = 0; i < patch.files.length; i++) {
    const file = patch.files[i];
    if (!file) continue;

    // Ensure the workspace file exists before patching.
    const workspacePath = toWorkspacePath(file.path);
    const realPath = resolve(REPO_ROOT, file.path);

    if (!existsSync(workspacePath)) {
      if (!existsSync(realPath)) {
        throw new ValidationError(
          `applyToShadow: source file not found in real target: ${file.path}`,
          { patchRef },
        );
      }
      mkdirSync(dirname(workspacePath), { recursive: true });
      copyFileSync(realPath, workspacePath);
    }

    // Write the unified diff to staging (audit trail).
    const diffFile = resolve(stagingDir, `${i}.patch`);
    writeFileSync(diffFile, file.diff, "utf8");

    // Apply: `patch -p1 -i <diffFile>` from SHADOW_WORKSPACE.
    // -p1 strips the leading `a/` / `b/` from unified diff paths, leaving
    // `apps/target/src/...` relative to SHADOW_WORKSPACE — matching toWorkspacePath().
    const result = spawnSync(
      "patch",
      ["-p1", "--no-backup-if-mismatch", "-i", diffFile],
      { cwd: SHADOW_WORKSPACE, encoding: "utf8", timeout: 10_000 },
    );

    if (result.status !== 0) {
      throw new ValidationError(
        `applyToShadow: patch command failed for ${file.path}: ` +
          `${(result.stdout ?? "") + (result.stderr ?? "")}`,
        { patchRef, file: file.path },
      );
    }
  }

  return { patchRef, shadowUrl: SHADOW_URL };
}

// ── replayTraffic ─────────────────────────────────────────────────────────────

export interface TrafficCase {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface TrafficReplay {
  case: TrafficCase;
  real: { status: number; body: string; durationMs: number };
  shadow: { status: number; body: string; durationMs: number };
}

async function fetchCase(
  baseUrl: string,
  tc: TrafficCase,
): Promise<{ status: number; body: string; durationMs: number }> {
  const start = Date.now();
  try {
    const init: RequestInit = {
      method: tc.method,
      headers: { "Content-Type": "application/json", ...tc.headers },
    };
    if (tc.body !== undefined) {
      init.body = JSON.stringify(tc.body);
    }
    const res = await fetch(`${baseUrl}${tc.path}`, init);
    const body = await res.text();
    return { status: res.status, body, durationMs: Date.now() - start };
  } catch (err) {
    return { status: 0, body: String(err), durationMs: Date.now() - start };
  }
}

/**
 * Replays a list of HTTP traffic cases against BOTH the real target and the
 * shadow twin in parallel, returning paired responses for T4.2 equivalence check.
 *
 * Status 0 in a result means the fetch itself failed (network error / not running).
 */
export async function replayTraffic(
  cases: TrafficCase[],
  opts: { targetUrl?: string; shadowUrl?: string } = {},
): Promise<TrafficReplay[]> {
  const targetUrl = opts.targetUrl ?? TARGET_URL;
  const shadowUrl = opts.shadowUrl ?? SHADOW_URL;

  const results: TrafficReplay[] = [];
  for (const tc of cases) {
    const [real, shadow] = await Promise.all([
      fetchCase(targetUrl, tc),
      fetchCase(shadowUrl, tc),
    ]);
    results.push({ case: tc, real, shadow });
  }
  return results;
}
