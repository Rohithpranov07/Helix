/**
 * T3.1 — Antibody minting
 *
 * mintAntibody: for every confirmed cure, produce a permanent regression test +
 * runtime assertion, embed the signature for vector recall (T3.2), persist to
 * the antibody collection, and write the regression test into the target app's
 * test suite so any recurrence is caught at CI.
 *
 * Sarvam (PRIMARY LLM) synthesises the regressionTest and runtimeAssertion.
 * embed() (Gemini or local) produces the 1536-dim vector for T3.2 recall.
 */
import { z } from "zod";
import { createHash } from "crypto";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import {
  ValidationError,
  ExternalApiError,
  type Antibody,
  type AntibodySource,
  type VulnClass,
} from "@helix/shared";
import { sarvam, embed } from "@helix/ai";
import {
  connectDb,
  createAntibody,
  findAntibodyByAntibodyId,
  findVulnerabilityById,
  findIncidentById,
  updateVulnerability,
  updateIncident,
  listAntibodies,
} from "@helix/db";

// ── Path helpers ──────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(__dirname, "../../../..");
const ANTIBODY_TEST_DIR = resolve(REPO_ROOT, "apps/target/src/__tests__/antibodies");

// ── antibodyId + signature ────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function makeAntibodyId(vulnClass: VulnClass, endpoint: string): string {
  return `ab-${slugify(vulnClass)}-${slugify(endpoint)}`;
}

export function makeSignature(vulnClass: VulnClass, endpoint: string): string {
  return createHash("sha256")
    .update(`${vulnClass}:${endpoint}`)
    .digest("hex")
    .slice(0, 16);
}

// ── Sarvam synthesis ──────────────────────────────────────────────────────────

const MintOutputSchema = z.object({
  regressionTest: z.string().min(50),
  runtimeAssertion: z.string().min(10),
});

type MintOutput = z.infer<typeof MintOutputSchema>;

const SYNTH_SYSTEM = [
  "You are HELIX's Immune Memory synthesizer.",
  "Given a confirmed and FIXED security vulnerability in the ShopLite demo app,",
  "produce two artefacts:",
  "1. regressionTest: a self-contained vitest test (TypeScript) that FAILS on the",
  "   OLD vulnerable code and PASSES on the fixed code. Use fetch() against",
  "   TARGET_URL env var (default http://localhost:3001). Import from 'vitest' only.",
  "2. runtimeAssertion: a one-sentence coding rule that, if violated, would re-introduce",
  "   this vulnerability.",
  "Respond ONLY with a JSON object: { regressionTest: string, runtimeAssertion: string }.",
].join(" ");

function buildSynthPrompt(
  vulnClass: VulnClass,
  endpoint: string,
  evidence: string,
): string {
  return [
    `Vulnerability class: ${vulnClass}`,
    `Fixed endpoint: ${endpoint}`,
    `Confirmation evidence: ${evidence.slice(0, 400)}`,
    "",
    "The regressionTest must:",
    "- Import { describe, it, expect } from 'vitest'",
    "- Describe the fixed behaviour (e.g. SQLi tautology returns 0 rows, XSS payload is escaped)",
    "- Include a TARGET_URL constant: const TARGET = process.env['TARGET_URL'] ?? 'http://localhost:3001'",
    "- Be a complete, runnable TypeScript file",
  ].join("\n");
}

// ── Per-class deterministic fallbacks (used when Sarvam is unavailable) ───────

const FALLBACKS: Record<VulnClass, (endpoint: string) => MintOutput> = {
  SQLi: (ep) => ({
    regressionTest: `import { describe, it, expect } from 'vitest';
describe('antibody: SQLi ${ep}', () => {
  it('parameterized query: tautology returns same rows as benign', async () => {
    const T = process.env['TARGET_URL'] ?? 'http://localhost:3001';
    const benign = await fetch(\`\${T}${ep}?q=NOMATCH_helix_xyz\`).then(r => r.json()) as { products?: unknown[] };
    const inject = await fetch(\`\${T}${ep}?q=%27+OR+%271%27%3D%271\`).then(r => r.json()) as { products?: unknown[] };
    expect(inject.products?.length ?? 0).toBeLessThanOrEqual((benign.products?.length ?? 0) + 1);
  });
});`,
    runtimeAssertion: "SQL queries must use parameterized placeholders; never interpolate user-controlled values into SQL strings.",
  }),
  XSS: (ep) => ({
    regressionTest: `import { describe, it, expect } from 'vitest';
describe('antibody: XSS ${ep}', () => {
  it('user input is escaped: <script> tag not reflected verbatim', async () => {
    const T = process.env['TARGET_URL'] ?? 'http://localhost:3001';
    const probe = 'helix-xss-ab-' + Date.now();
    const res = await fetch(\`\${T}${ep}?q=\${encodeURIComponent('<script>alert(\\'' + probe + '\\')</script>')}\`);
    const body = await res.text();
    expect(body).not.toContain('<script>alert(\\'' + probe + '\\')</script>');
  });
});`,
    runtimeAssertion: "User-supplied strings must never be passed to dangerouslySetInnerHTML; use text-only rendering or a sanitizer.",
  }),
  missingRLS: (ep) => ({
    regressionTest: `import { describe, it, expect } from 'vitest';
describe('antibody: missingRLS ${ep}', () => {
  it('RLS enforced: unauthenticated request returns 401 or single-user data only', async () => {
    const T = process.env['TARGET_URL'] ?? 'http://localhost:3001';
    const res = await fetch(\`\${T}${ep}\`);
    if (res.status === 200) {
      const body = await res.text();
      const uuids = [...new Set((body.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? []))];
      const userUuids = uuids.filter(u => !u.startsWith('a1b2c3d4'));
      expect(userUuids.length).toBeLessThan(2);
    } else {
      expect([401, 403]).toContain(res.status);
    }
  });
});`,
    runtimeAssertion: "Row-Level Security must be enabled on the orders table with a policy restricting reads to auth.uid() == user_id.",
  }),
  secretLeak: (_ep) => ({
    regressionTest: `import { describe, it, expect } from 'vitest';
describe('antibody: secretLeak (client bundle)', () => {
  it('service key is not present in any JS bundle', async () => {
    const T = process.env['TARGET_URL'] ?? 'http://localhost:3001';
    const indexHtml = await fetch(\`\${T}/search\`).then(r => r.text());
    const chunks = [...new Set((indexHtml.match(/\\/_next\\/static\\/chunks\\/[^\\s"']+\\.js/g) ?? []))];
    for (const chunk of chunks.slice(0, 20)) {
      const js = await fetch(T + chunk).then(r => r.text()).catch(() => '');
      expect(js).not.toMatch(/service_role/);
      expect(js).not.toMatch(/HELIX_DEMO_FAKE/);
    }
    expect(indexHtml).not.toMatch(/service_role/);
  });
});`,
    runtimeAssertion: "Service role keys and secrets must never be imported from client-side modules; access them only in server-only routes via process.env.",
  }),
  authBypass: (ep) => ({
    regressionTest: `import { describe, it, expect } from 'vitest';
describe('antibody: authBypass ${ep}', () => {
  it('protected endpoint rejects unauthenticated requests', async () => {
    const T = process.env['TARGET_URL'] ?? 'http://localhost:3001';
    const res = await fetch(\`\${T}${ep}\`);
    expect([401, 403, 302]).toContain(res.status);
  });
});`,
    runtimeAssertion: "Every admin or protected route must verify session authentication server-side before returning any data.",
  }),
};

async function synthesise(
  vulnClass: VulnClass,
  endpoint: string,
  evidence: string,
): Promise<MintOutput> {
  try {
    const result = await sarvam.chat({
      messages: [
        { role: "system", content: SYNTH_SYSTEM },
        { role: "user", content: buildSynthPrompt(vulnClass, endpoint, evidence) },
      ],
      schema: MintOutputSchema,
      temperature: 0.2,
    });
    return MintOutputSchema.parse(JSON.parse(result.content));
  } catch {
    // Sarvam unavailable — use deterministic per-class template.
    return FALLBACKS[vulnClass](endpoint);
  }
}

// ── Regression test placement ─────────────────────────────────────────────────

export function writeRegressionTest(antibodyId: string, testCode: string): string {
  mkdirSync(ANTIBODY_TEST_DIR, { recursive: true });
  const path = resolve(ANTIBODY_TEST_DIR, `${antibodyId}.test.ts`);
  writeFileSync(path, testCode, "utf8");
  return path;
}

// ── Source lookup ─────────────────────────────────────────────────────────────

interface SourceContext {
  vulnClass: VulnClass;
  endpoint: string;
  evidence: string;
}

async function resolveSource(
  type: AntibodySource,
  ref: string,
): Promise<SourceContext> {
  if (type === "vuln") {
    const doc = await findVulnerabilityById(ref);
    if (!doc) throw new ValidationError(`Vulnerability ${ref} not found for antibody minting`);
    return { vulnClass: doc.class, endpoint: doc.endpoint, evidence: doc.evidence };
  }

  const doc = await findIncidentById(ref);
  if (!doc) throw new ValidationError(`Incident ${ref} not found for antibody minting`);
  // Incidents don't have a single vuln class — derive from the causal chain.
  // Default to authBypass as the class most associated with incidents.
  const vulnClass: VulnClass = "authBypass";
  const endpoint = String(
    (doc.failingRequest as Record<string, unknown>)?.url ?? "/unknown",
  );
  return {
    vulnClass,
    endpoint,
    evidence: `Incident ${doc.incidentId}: baselineDelta=${doc.baselineDelta}ms`,
  };
}

// ── mintAntibody ──────────────────────────────────────────────────────────────

export interface MintSource {
  type: AntibodySource;
  /** MongoDB _id of the source vulnerability or incident. */
  ref: string;
}

/**
 * Mints a permanent antibody for a confirmed, fixed vulnerability.
 * Idempotent: returns the existing antibody if already minted for this class+endpoint.
 *
 * 1. Looks up source context (class, endpoint, evidence).
 * 2. Sarvam synthesises regressionTest + runtimeAssertion.
 * 3. embed() computes the 1536-dim vector for T3.2 recall.
 * 4. Persists to the antibody collection (exact §B.2 shape).
 * 5. Writes the regression test to apps/target/src/__tests__/antibodies/.
 * 6. Links antibodyId back to the source document.
 * 7. Logs the global antibody count.
 */
export async function mintAntibody(source: MintSource): Promise<Antibody> {
  await connectDb();

  const ctx = await resolveSource(source.type, source.ref);
  const { vulnClass, endpoint, evidence } = ctx;

  const antibodyId = makeAntibodyId(vulnClass, endpoint);
  const signature = makeSignature(vulnClass, endpoint);

  // Idempotent: return existing antibody without re-minting.
  const existing = await findAntibodyByAntibodyId(antibodyId);
  if (existing) {
    return existing;
  }

  // Synthesise regressionTest + runtimeAssertion via Sarvam.
  const { regressionTest, runtimeAssertion } = await synthesise(
    vulnClass,
    endpoint,
    evidence,
  );

  // Compute semantic embedding for T3.2 vector recall.
  let embedding: number[];
  try {
    embedding = await embed(`${vulnClass} ${endpoint} ${signature} ${regressionTest.slice(0, 300)}`);
  } catch (err) {
    if (err instanceof ExternalApiError) {
      throw new ValidationError(
        `mintAntibody: embedding failed (${err.message}). ` +
          "Set GEMINI_API_KEY or EMBEDDING_PROVIDER=local.",
        err,
      );
    }
    throw err;
  }

  const antibody: Antibody = {
    antibodyId,
    sourceType: source.type,
    signature,
    embedding,
    regressionTest,
    runtimeAssertion,
    mintedAt: new Date().toISOString(),
    recurrencesBlocked: 0,
  };

  const doc = await createAntibody(antibody);

  // Write regression test into the target app's test suite.
  writeRegressionTest(antibodyId, regressionTest);

  // Link antibodyId back to the source document.
  if (source.type === "vuln") {
    await updateVulnerability(source.ref, { antibodyId });
  } else {
    await updateIncident(source.ref, { antibodyId });
  }

  // Log global antibody count.
  const total = await listAntibodies();
  // eslint-disable-next-line no-console
  console.log(`[mint] antibody minted: ${antibodyId} (total: ${total.length})`);

  return doc;
}
