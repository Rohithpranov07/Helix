/**
 * T2.3 — Patch synthesis + Shadow apply
 *
 * synthesizePatch: Sarvam (PRIMARY LLM) generates a class-appropriate minimal
 *   fix as a strict-JSON, Zod-validated unified diff.
 * applyInShadow:   applies the patch to the Shadow twin ONLY (T4.1 runtime).
 *   It NEVER writes to the real target. Until T4.1 is wired, the default
 *   applier throws — the Shadow invariant is preserved by construction.
 */
import { z } from "zod";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { ValidationError, type Vulnerability, type VulnClass } from "@helix/shared";
import { sarvam } from "@helix/ai";
import { connectDb, updateVulnerability } from "@helix/db";
import type { HelixDoc } from "@helix/db";

// T4.2 reads this file to discover vulnClass + endpoint from a changeRef alone.
const SHADOW_STAGING = resolve(__dirname, "../../../../shadow/staging");

// ── Patch contract (engine-internal) ──────────────────────────────────────────

export interface PatchFile {
  path: string;
  diff: string;
}

export interface Patch {
  files: PatchFile[];
  rationale: string;
}

const PatchSchema = z.object({
  files: z
    .array(
      z.object({
        path: z.string().min(1),
        diff: z.string().min(1),
      }),
    )
    .min(1),
  rationale: z.string().min(1),
});

// ── Guardrails (T2.3 req 3) ───────────────────────────────────────────────────

/** Every patched file must live inside the target app. */
const TARGET_ROOT = "apps/target/";
/** Reject runaway LLM output. */
const MAX_FILES = 5;
const MAX_TOTAL_DIFF_CHARS = 20_000;

/**
 * Rejects patches that touch files outside the target app or exceed the size
 * threshold. Throws ValidationError. This is a hard safety boundary — a patch
 * that fails it is never applied anywhere.
 */
export function assertPatchSafe(patch: Patch): void {
  if (patch.files.length > MAX_FILES) {
    throw new ValidationError(
      `Patch touches ${patch.files.length} files (max ${MAX_FILES})`,
      { files: patch.files.map((f) => f.path) },
    );
  }

  let totalChars = 0;
  for (const file of patch.files) {
    const p = file.path.replace(/^\.\//, "");

    if (p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p)) {
      throw new ValidationError(`Patch path is absolute, not allowed: ${file.path}`);
    }
    if (p.split("/").includes("..")) {
      throw new ValidationError(`Patch path escapes target with "..": ${file.path}`);
    }
    if (!p.startsWith(TARGET_ROOT)) {
      throw new ValidationError(
        `Patch path is outside the target app (${TARGET_ROOT}): ${file.path}`,
      );
    }
    totalChars += file.diff.length;
  }

  if (totalChars > MAX_TOTAL_DIFF_CHARS) {
    throw new ValidationError(
      `Patch diff is ${totalChars} chars (max ${MAX_TOTAL_DIFF_CHARS})`,
    );
  }
}

// ── Synthesis (T2.3 req 1) ────────────────────────────────────────────────────

/** Known ShopLite source file + fix strategy per vulnerability class. */
const CLASS_GUIDANCE: Record<VulnClass, { file: string; strategy: string }> = {
  SQLi: {
    file: "apps/target/src/app/api/products/search/route.ts",
    strategy:
      "Replace the string-concatenated SQL with a parameterized query (use bound parameters / placeholders). Never interpolate user input into the SQL string.",
  },
  XSS: {
    file: "apps/target/src/app/search/page.tsx",
    strategy:
      "Remove dangerouslySetInnerHTML and render the user-supplied value as escaped text content so HTML/script is not interpreted. If markup is truly needed, sanitize first.",
  },
  missingRLS: {
    file: "apps/target/supabase/migrations/002_orders_rls.sql",
    strategy:
      "Add a new SQL migration that ENABLEs Row-Level Security on the `orders` table and creates a policy restricting SELECT/UPDATE/DELETE to rows where user_id = auth.uid(). Do not weaken existing policies.",
  },
  secretLeak: {
    file: "apps/target/src/lib/adminClient.ts",
    strategy:
      "Remove the hardcoded service key from client-side code. Move privileged operations to a server-only route that reads the key from process.env, so the secret never reaches the browser bundle.",
  },
  authBypass: {
    file: "apps/target/src/app/admin/orders/page.tsx",
    strategy:
      "Add a server-side authentication/authorization check that rejects unauthenticated or non-admin requests before returning any protected data.",
  },
};

const SYNTH_SYSTEM_PROMPT = [
  "You are HELIX's Immune System patch synthesizer for the demo app 'ShopLite'.",
  "Produce the MINIMAL security fix for the given vulnerability — change only what is",
  "necessary to close the hole, preserving all intended behaviour.",
  "Output a unified diff per file. Every file path MUST be inside 'apps/target/'.",
  "Respond as a JSON object with this exact shape:",
  '{ "files": [ { "path": string, "diff": string } ], "rationale": string }',
  "The diff must be a valid unified diff (--- / +++ / @@ hunks). Do not include",
  "explanations outside the JSON.",
].join(" ");

function buildUserPrompt(finding: Vulnerability): string {
  const guidance = CLASS_GUIDANCE[finding.class];
  return [
    `Vulnerability class: ${finding.class}`,
    `Endpoint: ${finding.endpoint}`,
    `Likely file to fix: ${guidance.file}`,
    `Fix strategy: ${guidance.strategy}`,
    "",
    "Reproduction evidence:",
    finding.evidence,
    "",
    "Generate the minimal patch as unified diffs. Touch only files under apps/target/.",
  ].join("\n");
}

/**
 * Generates a class-appropriate minimal patch for a confirmed finding using
 * Sarvam in strict-JSON mode. The result is Zod-validated and passed through
 * the safety guardrail before being returned.
 */
export async function synthesizePatch(finding: Vulnerability): Promise<Patch> {
  const result = await sarvam.chat({
    messages: [
      { role: "system", content: SYNTH_SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(finding) },
    ],
    schema: PatchSchema,
    temperature: 0.1,
  });

  // chat() returns JSON.stringify(validated.data) when a schema is supplied.
  const patch = PatchSchema.parse(JSON.parse(result.content)) as Patch;

  assertPatchSafe(patch);
  return patch;
}

// ── Shadow application seam (T2.3 req 2) ──────────────────────────────────────

export interface ShadowApplyResult {
  /** Opaque reference to the applied change inside the Shadow (stored as patchRef). */
  patchRef: string;
  /** The Shadow twin base URL the patch was applied to (never the real target). */
  shadowUrl: string;
}

/**
 * Applies a patch to the Shadow twin. Provided by T4.1
 * (`packages/engine/src/shadow/runtime.ts#applyToShadow`). Injected here so
 * patch.ts never has to reach outside its own boundary, and so tests can supply
 * a stub. It must NEVER target the real app on :3001.
 */
export type ShadowApplier = (patch: Patch) => Promise<ShadowApplyResult>;

/**
 * Default applier — the Shadow runtime (T4.1) is not wired yet. It throws rather
 * than ever falling back to the real target. This preserves the Shadow invariant
 * by construction: no Shadow runtime ⇒ no application, never a real-target write.
 */
const unavailableApplier: ShadowApplier = async () => {
  throw new ValidationError(
    "Shadow runtime is not available (T4.1 not yet built). " +
      "applyInShadow requires an injected ShadowApplier; it will NEVER write to the real target.",
  );
};

/**
 * Applies a synthesized patch to the Shadow twin ONLY, then records the patch on
 * the vulnerability (status:'patching', patchRef). Never writes to the real target.
 *
 * @param applier Shadow application fn from T4.1. Defaults to a throwing stub.
 */
/**
 * T4.1 wiring note — when the Shadow runtime lands, wire it as:
 *   `HealDeps.applyShadow = (f, p) => applyInShadow(f, p, runtime.applyToShadow)`
 * This preserves the assertPatchSafe re-check and the DB record.
 * Never do: `HealDeps.applyShadow = (f, p) => runtime.applyToShadow(p)`
 * — that would bypass the guardrail.
 */
export async function applyInShadow(
  finding: HelixDoc<Vulnerability>,
  patch: Patch,
  applier: ShadowApplier = unavailableApplier,
): Promise<ShadowApplyResult> {
  // Re-assert the guardrail at the application boundary — defence in depth.
  assertPatchSafe(patch);

  // connectDb before the applier: if applier succeeds but the DB write fails,
  // we at least have a connected client ready for any subsequent retry logic.
  await connectDb();

  const applied = await applier(patch);

  // Write staging metadata so T4.2 verifyEquivalence can discover the
  // vulnerability class and endpoint from changeRef (patchRef) alone.
  const metaDir = resolve(SHADOW_STAGING, applied.patchRef);
  mkdirSync(metaDir, { recursive: true });
  writeFileSync(
    resolve(metaDir, "meta.json"),
    JSON.stringify({
      findingId: finding._id,
      vulnClass: finding.class,
      endpoint: finding.endpoint,
    }),
    "utf8",
  );

  await updateVulnerability(finding._id, {
    status: "patching",
    patchRef: applied.patchRef,
  });

  return applied;
}
