/**
 * T6.1 — Intent strand capture (Genome organ)
 *
 * captureIntent: reads a source module, uses Sarvam (PRIMARY LLM) in strict-JSON
 *   mode to extract the module's intent strand — purpose, invariants (with
 *   compliance flags), and edge-case design decisions — then persists it to
 *   the `intent_strand` MongoDB collection.
 *
 * Idempotent: upserts by moduleId so re-running always reflects the current code.
 *
 * Initial pairing: score:1.0 + unpairedInvariants:[] on first capture (T6.2
 *   computes the actual pairing score by comparing intent to live code).
 *
 * Seed: seedShopLite() captures all five ShopLite modules with explicit compliance
 *   context so the Genome is pre-loaded for the hackathon demo.
 */
import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { ValidationError, type IntentStrand } from "@helix/shared";
import { sarvam } from "@helix/ai";
import {
  connectDb,
  createIntentStrand,
  updateIntentStrand,
  listIntentStrands,
} from "@helix/db";
import type { HelixDoc } from "@helix/db";

// ── Constants ─────────────────────────────────────────────────────────────────

// packages/engine/src/genome/ → 4 levels up = repo root
const REPO_ROOT = resolve(__dirname, "../../../../");

// ── Sarvam extraction ─────────────────────────────────────────────────────────

const CaptureOutputSchema = z.object({
  purpose: z.string().min(10),
  invariants: z
    .array(
      z.object({
        id: z.string().min(1),
        rule: z.string().min(5),
        rationale: z.string().min(5),
        compliance: z.boolean().optional(),
      }),
    )
    .min(2)
    .max(8),
  edgeDecisions: z.array(z.string().min(5)).min(1).max(6),
});

const CAPTURE_SYSTEM = [
  "You are HELIX's Genome organ. Your role is to extract the INTENT STRAND of a software module.",
  "An intent strand captures WHY the module exists and the invariants that must ALWAYS hold.",
  "Given a module's source code and optional context (PR description, spec, compliance notes),",
  "extract:",
  "  purpose: 1-2 sentences describing what this module is designed to do and why.",
  "  invariants: 3-6 rules that must always be true for the module to be correct. Each has:",
  "    id: 'inv-N' (sequential), rule: the constraint in plain English,",
  "    rationale: why this rule matters, compliance: true ONLY if legally or regulatorily required.",
  "  edgeDecisions: 2-5 non-obvious design choices baked into the code",
  "    (e.g. 'fallback to mock data when Supabase is unavailable').",
  "Mark compliance:true for ANY invariant that is a legal, regulatory, or audit requirement.",
  "Respond ONLY with JSON:",
  '{ "purpose": string, "invariants": [...], "edgeDecisions": [...] }',
].join(" ");

function buildCapturePrompt(
  modulePath: string,
  source: string,
  context: string,
): string {
  return [
    `Module: ${modulePath}`,
    "",
    context ? `Context (PR description / spec / compliance notes):\n${context}` : "",
    "",
    "Source code:",
    "```",
    source.slice(0, 6000),
    "```",
    "",
    "Extract the intent strand. Ensure at least one invariant has compliance:true if",
    "the context mentions legal, regulatory, or approval requirements.",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

async function sarvamExtract(
  modulePath: string,
  source: string,
  context: string,
): Promise<z.infer<typeof CaptureOutputSchema>> {
  const result = await sarvam.chat({
    messages: [
      { role: "system", content: CAPTURE_SYSTEM },
      { role: "user", content: buildCapturePrompt(modulePath, source, context) },
    ],
    schema: CaptureOutputSchema,
    temperature: 0.2,
  });
  return CaptureOutputSchema.parse(JSON.parse(result.content));
}

// ── Deterministic fallback ────────────────────────────────────────────────────

function deterministicExtract(
  modulePath: string,
  context: string,
): z.infer<typeof CaptureOutputSchema> {
  const isCompliance = /refund|approval|compliance|regulation/i.test(context);
  return {
    purpose: `Module at ${modulePath}. ${context.slice(0, 120) || "No additional context provided."}`,
    invariants: [
      {
        id: "inv-1",
        rule: "Module must handle all inputs without crashing the application.",
        rationale: "Stability and availability are baseline requirements.",
        compliance: false,
      },
      {
        id: "inv-2",
        rule: isCompliance
          ? "All high-value operations above the configured threshold require explicit approval before execution."
          : "All mutations must be validated before being persisted.",
        rationale: isCompliance
          ? "Regulatory requirement: high-value transactions must have an audit trail with dual control."
          : "Data integrity requires that invalid state never reaches the database.",
        compliance: isCompliance,
      },
    ],
    edgeDecisions: [
      "Sarvam was unavailable; intent extracted deterministically from module path and context.",
    ],
  };
}

// ── captureIntent ─────────────────────────────────────────────────────────────

/**
 * Captures (or refreshes) the intent strand for a source module.
 *
 * @param modulePath  Repo-relative path (e.g. "apps/target/src/app/api/products/search/route.ts")
 * @param context     Optional PR description, spec, or compliance notes to supplement the code.
 */
export async function captureIntent(
  modulePath: string,
  context = "",
): Promise<HelixDoc<IntentStrand>> {
  await connectDb();

  // Read the source file from disk.
  const absPath = resolve(REPO_ROOT, modulePath);
  if (!existsSync(absPath)) {
    throw new ValidationError(
      `captureIntent: module not found at ${absPath}. ` +
        "Provide a repo-relative path (e.g. 'apps/target/src/app/api/products/search/route.ts').",
    );
  }
  const source = readFileSync(absPath, "utf8");

  // Sarvam extracts purpose, invariants, edgeDecisions.
  let extracted: z.infer<typeof CaptureOutputSchema>;
  try {
    extracted = await sarvamExtract(modulePath, source, context);
  } catch {
    extracted = deterministicExtract(modulePath, context);
  }

  const now = new Date().toISOString();
  const strand: IntentStrand = {
    moduleId: modulePath,
    purpose: extracted.purpose,
    // exactOptionalPropertyTypes: omit compliance when undefined rather than setting it to undefined.
    invariants: extracted.invariants.map(({ compliance, ...rest }) => ({
      ...rest,
      ...(compliance !== undefined ? { compliance } : {}),
    })),
    edgeDecisions: extracted.edgeDecisions,
    sourcePrompt: context || `Auto-captured from source: ${modulePath}`,
    generatedBy: { model: "sarvam-m", version: "1" },
    pairing: {
      score: 1.0,
      lastChecked: now,
      unpairedInvariants: [],
    },
  };

  // Upsert: update if a strand for this module already exists, else create.
  const existing = await listIntentStrands({ moduleId: modulePath } as Partial<IntentStrand>);
  const prior = existing[0];
  if (prior) {
    // Preserve pairing score from the last T6.2 run — only update intent fields.
    const update: Partial<IntentStrand> = {
      purpose: strand.purpose,
      invariants: strand.invariants,
      edgeDecisions: strand.edgeDecisions,
      sourcePrompt: strand.sourcePrompt,
      generatedBy: strand.generatedBy,
    };
    const updated = await updateIntentStrand(prior._id, update);
    if (!updated) throw new ValidationError(`captureIntent: update failed for ${modulePath}`);
    // eslint-disable-next-line no-console
    console.log(`[genome] updated strand: ${modulePath} (${extracted.invariants.length} invariants)`);
    return updated;
  }

  const created = await createIntentStrand(strand);
  // eslint-disable-next-line no-console
  console.log(`[genome] created strand: ${modulePath} (${extracted.invariants.length} invariants)`);
  return created;
}

// ── ShopLite seed ─────────────────────────────────────────────────────────────

/**
 * Known ShopLite modules with their compliance/spec context.
 * The admin/orders module carries the critical compliance invariant
 * "refunds over a threshold require approval" (demo requirement).
 */
export const SHOPLITE_MODULES: Array<{ path: string; context: string }> = [
  {
    path: "apps/target/src/app/api/products/search/route.ts",
    context:
      "PR: Implement product search API. " +
      "The search endpoint accepts a query string and returns matching products from the database. " +
      "SECURITY REQUIREMENT: All database queries must use parameterized inputs to prevent SQL injection. " +
      "User-supplied query parameters must never be interpolated directly into SQL strings.",
  },
  {
    path: "apps/target/src/app/search/page.tsx",
    context:
      "PR: Product search UI page. " +
      "Renders search results from the API. User-controlled query parameters are displayed in the UI. " +
      "SECURITY REQUIREMENT: User-supplied content must never be rendered as raw HTML. " +
      "All dynamic content must be properly escaped to prevent cross-site scripting (XSS).",
  },
  {
    path: "apps/target/src/app/admin/orders/page.tsx",
    context:
      "PR: Admin order management page including refund processing. " +
      "This page is accessible only to authenticated administrators. " +
      "COMPLIANCE REQUIREMENT: Refunds exceeding $100 must be routed through an explicit approval " +
      "workflow before being applied. This is a regulatory requirement for financial audit trails — " +
      "no high-value refund may be processed without a dual-control approval step. " +
      "SECURITY REQUIREMENT: Unauthenticated or non-admin requests must be rejected with 401/403 " +
      "before any order data is returned.",
  },
  {
    path: "apps/target/src/app/api/auth/login/route.ts",
    context:
      "PR: Authentication login endpoint. " +
      "Accepts credentials and returns a session token. " +
      "SECURITY REQUIREMENT: Credentials must be validated against the auth provider; " +
      "raw passwords must never be logged or stored. " +
      "Failed login attempts should not reveal whether the username exists.",
  },
  {
    path: "apps/target/src/lib/adminClient.ts",
    context:
      "PR: Supabase admin client with service-role key access. " +
      "Used for privileged operations that bypass Row Level Security. " +
      "SECURITY REQUIREMENT: The service-role key must NEVER be exposed to client-side code " +
      "or included in browser bundles. All admin operations must run server-side only. " +
      "COMPLIANCE: Access to this client is an audit event — all usages must be traceable.",
  },
];

/**
 * Seeds intent strands for all ShopLite modules. Safe to re-run (upserts).
 * Emits each captured strand to stdout for verification.
 */
export async function seedShopLite(): Promise<HelixDoc<IntentStrand>[]> {
  const results: HelixDoc<IntentStrand>[] = [];
  for (const mod of SHOPLITE_MODULES) {
    const strand = await captureIntent(mod.path, mod.context);
    results.push(strand);
  }
  return results;
}
