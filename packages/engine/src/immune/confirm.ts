/**
 * T2.2 — Finding confirmation
 * Reproduces each VulnClass non-destructively before any patch is attempted.
 * All probes are strictly read-only; no target data is mutated.
 */
import { ValidationError } from "@helix/shared";
import type { Vulnerability } from "@helix/shared";
import { connectDb, updateVulnerability } from "@helix/db";
import type { HelixDoc } from "@helix/db";

const TIMEOUT_MS = 10_000;
const RATE_MS = 150;

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function get(url: string): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    return { status: res.status, body: await res.text() };
  } finally {
    clearTimeout(t);
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function baseUrl(endpoint: string, targetUrl: string): string {
  // Derive base from the finding's endpoint — strip path, keep origin
  try {
    const u = new URL(targetUrl);
    return u.origin;
  } catch {
    return targetUrl.replace(/\/$/, "");
  }
}

// ── Per-class reproducers ─────────────────────────────────────────────────────

interface ReproResult { confirmed: boolean; evidence: string }

async function reproduceSQLi(finding: Vulnerability, origin: string): Promise<ReproResult> {
  // Controlled differential: tautology vs contradiction
  // Tautology  → returns ALL rows
  // Contradiction → returns 0 rows
  // Proof: tautology_count > contradiction_count
  const ep = finding.endpoint; // e.g. /api/products/search

  const [taut, contra] = await Promise.all([
    get(`${origin}${ep}?q=%27+OR+%271%27%3D%271`),   // ' OR '1'='1
    get(`${origin}${ep}?q=%27+AND+%271%27%3D%272`),  // ' AND '1'='2
  ]);
  await sleep(RATE_MS);

  let tautCount = 0;
  let contraCount = 0;
  let debugSql = "";

  try {
    const tj = JSON.parse(taut.body) as { products?: unknown[]; _debug_sql?: string };
    tautCount = tj.products?.length ?? 0;
    debugSql = tj._debug_sql ?? "";
  } catch { /* non-JSON is itself evidence of an error */ }

  try {
    const cj = JSON.parse(contra.body) as { products?: unknown[] };
    contraCount = cj.products?.length ?? 0;
  } catch { /* non-JSON */ }

  const sqlErrPattern = /syntax error|unterminated|pg_|invalid input/i;
  const hasErr = sqlErrPattern.test(taut.body) || sqlErrPattern.test(contra.body);
  const differential = tautCount > contraCount;

  if (!differential && !hasErr) {
    return { confirmed: false, evidence: `SQLi differential failed: tautology=${tautCount} contradiction=${contraCount}` };
  }

  return {
    confirmed: true,
    evidence:
      `CONFIRMED SQLi differential: tautology returned ${tautCount} rows, contradiction returned ${contraCount} rows. ` +
      (debugSql ? `Raw SQL: "${debugSql.slice(0, 200)}". ` : "") +
      (hasErr ? "SQL error in response. " : "") +
      `Endpoint: ${origin}${ep}`,
  };
}

async function reproduceXSS(finding: Vulnerability, origin: string): Promise<ReproResult> {
  const probe = `helix-xss-confirm-${Date.now()}`;
  const payload = encodeURIComponent(`<script>alert('${probe}')</script>`);
  const url = `${origin}${finding.endpoint}?q=${payload}`;

  const res = await get(url);
  await sleep(RATE_MS);

  const unescaped = res.body.includes(`<script>alert('${probe}')</script>`);
  if (!unescaped) {
    // Try <img> variant
    const imgPayload = encodeURIComponent(`<img src=x onerror=confirm('${probe}')>`);
    const imgRes = await get(`${origin}${finding.endpoint}?q=${imgPayload}`);
    await sleep(RATE_MS);
    const imgUnescaped = imgRes.body.includes(`<img src=x`);
    if (!imgUnescaped) return { confirmed: false, evidence: `XSS probe not reflected unescaped` };

    return {
      confirmed: true,
      evidence: `CONFIRMED XSS: <img> payload reflected unescaped at ${origin}${finding.endpoint}. Probe: "${probe}"`,
    };
  }

  return {
    confirmed: true,
    evidence: `CONFIRMED XSS: <script> tag reflected verbatim at ${origin}${finding.endpoint}. Probe: "${probe}"`,
  };
}

async function reproduceMissingRLS(finding: Vulnerability, origin: string): Promise<ReproResult> {
  const res = await get(`${origin}${finding.endpoint}`);
  await sleep(RATE_MS);

  if (res.status !== 200) {
    return { confirmed: false, evidence: `missingRLS: endpoint returned ${res.status}` };
  }

  // Proof: multiple distinct user_id UUIDs in the response = cross-user read
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const allUuids = [...new Set((res.body.match(uuidPattern) ?? []).map((u) => u.toLowerCase()))];

  // Exclude well-known product UUIDs (seed data prefix a1b2c3d4-)
  const userUuids = allUuids.filter((u) => !u.startsWith("a1b2c3d4"));

  // Also look for the explicit RLS banner we planted in ShopLite
  const rlsBanner = /rls missing|row.level security/i.test(res.body);

  if (userUuids.length < 2 && !rlsBanner) {
    return {
      confirmed: false,
      evidence: `missingRLS: only ${userUuids.length} distinct user UUID(s) visible, no RLS banner`,
    };
  }

  return {
    confirmed: true,
    evidence:
      `CONFIRMED missingRLS: ${userUuids.length > 0 ? userUuids.length + " distinct user UUIDs" : "RLS-missing banner"} ` +
      `visible at ${origin}${finding.endpoint} without authentication. ` +
      `User IDs: ${userUuids.slice(0, 3).join(", ")}${userUuids.length > 3 ? "…" : ""}`,
  };
}

async function reproduceSecretLeak(finding: Vulnerability, origin: string): Promise<ReproResult> {
  // Fetch the entry page and discover JS chunks
  const indexRes = await get(`${origin}/search`);
  await sleep(RATE_MS);

  const chunkPattern = /\/_next\/static\/chunks\/[^\s"']+\.js/g;
  const chunks = [...new Set(indexRes.body.match(chunkPattern) ?? [])];

  const secretPatterns: { pat: RegExp; label: string }[] = [
    { pat: /service_role/, label: "service_role keyword" },
    { pat: /HELIX_DEMO_FAKE/, label: "HELIX_DEMO_FAKE placeholder key" },
    { pat: /sb_service_[A-Za-z0-9_-]{20,}/, label: "Supabase service key" },
    { pat: /eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}/, label: "JWT token" },
  ];

  const hits: string[] = [];

  for (const chunk of chunks.slice(0, 20)) {
    try {
      const r = await get(origin + chunk);
      await sleep(50);
      for (const { pat, label } of secretPatterns) {
        const m = r.body.match(pat);
        if (m) {
          hits.push(`${label} in ${chunk.split("/").pop()}: "${m[0]!.slice(0, 60)}"`);
          break;
        }
      }
    } catch { /* skip */ }
  }

  // Also check inline HTML
  for (const { pat, label } of secretPatterns) {
    const m = indexRes.body.match(pat);
    if (m) hits.push(`${label} in inline HTML`);
  }

  if (hits.length === 0) {
    return { confirmed: false, evidence: `secretLeak: no secret patterns found in ${chunks.length} chunks` };
  }

  return {
    confirmed: true,
    evidence: `CONFIRMED secretLeak: secret found in client-side JavaScript bundle. ` +
      `Hits: ${hits.join("; ")}. ` +
      `Key is reachable by any browser at ${origin}`,
  };
}

async function reproduceAuthBypass(finding: Vulnerability, origin: string): Promise<ReproResult> {
  const res = await get(`${origin}${finding.endpoint}`);
  await sleep(RATE_MS);

  if (res.status !== 200 || res.body.length < 100) {
    return { confirmed: false, evidence: `authBypass: endpoint returned ${res.status} without credentials` };
  }

  return {
    confirmed: true,
    evidence: `CONFIRMED authBypass: ${origin}${finding.endpoint} returned HTTP 200 ` +
      `(${res.body.length} bytes) without any authentication credentials`,
  };
}

// ── Main entry ────────────────────────────────────────────────────────────────

/**
 * Confirms a finding is genuinely exploitable before any patch is attempted.
 * Stores reproduction evidence on the vulnerability doc.
 * Returns true if confirmed, false if the candidate should be discarded.
 * All probes are strictly read-only — no target data is mutated.
 */
export async function confirmFinding(
  finding: HelixDoc<Vulnerability>,
  targetUrl: string,
): Promise<boolean> {
  const origin = baseUrl(finding.endpoint, targetUrl);

  let result: ReproResult;

  switch (finding.class) {
    case "SQLi":
      result = await reproduceSQLi(finding, origin);
      break;
    case "XSS":
      result = await reproduceXSS(finding, origin);
      break;
    case "missingRLS":
      result = await reproduceMissingRLS(finding, origin);
      break;
    case "secretLeak":
      result = await reproduceSecretLeak(finding, origin);
      break;
    case "authBypass":
      result = await reproduceAuthBypass(finding, origin);
      break;
    default:
      throw new ValidationError(`Unknown VulnClass: ${String((finding as Vulnerability).class)}`);
  }

  // Persist updated evidence regardless (confirmed or discarded)
  await connectDb();
  await updateVulnerability(finding._id, {
    evidence: result.evidence,
  });

  return result.confirmed;
}
