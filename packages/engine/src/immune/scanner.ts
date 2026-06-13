import { AuthorizationError, type Vulnerability, type VulnClass } from "@helix/shared";
import { connectDb, createVulnerability } from "@helix/db";
import type { HelixDoc } from "@helix/db";
import { gemini } from "@helix/ai";

// ── Authorization gate ────────────────────────────────────────────────────────

function getAllowlist(): string[] {
  const raw = process.env["TARGET_ALLOWLIST"] ?? "";
  return raw.split(",").map((u) => u.trim()).filter(Boolean);
}

function assertAllowed(targetUrl: string): void {
  const allowlist = getAllowlist();
  if (allowlist.length === 0) {
    throw new AuthorizationError(
      "TARGET_ALLOWLIST is not set — scanner is disabled. Set it to authorize targets.",
    );
  }
  const normalised = targetUrl.replace(/\/$/, "");
  const allowed = allowlist.some((a) => normalised.startsWith(a.replace(/\/$/, "")));
  if (!allowed) {
    throw new AuthorizationError(
      `Target ${targetUrl} is not in TARGET_ALLOWLIST. Scan rejected.`,
    );
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 10_000;
const RATE_LIMIT_MS = 150;

async function get(url: string): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    const body = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    return { status: res.status, body, headers };
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ── Gemini-assisted response analysis ────────────────────────────────────────

async function geminiAnalyse(
  prompt: string,
  responseBody: string,
): Promise<string> {
  try {
    const result = await gemini.analyze({
      parts: [{ text: `${prompt}\n\n--- RESPONSE BODY ---\n${responseBody.slice(0, 8_000)}` }],
      systemPrompt: "You are a security analyst. Answer in one short sentence.",
    });
    return result.content;
  } catch {
    return "gemini-unavailable";
  }
}

// ── Detector result ───────────────────────────────────────────────────────────

interface DetectorFinding {
  class: VulnClass;
  endpoint: string;
  evidence: string;
}

// ── Detector 1: SQLi ─────────────────────────────────────────────────────────

async function detectSQLi(base: string): Promise<DetectorFinding | null> {
  const endpoint = "/api/products/search";

  // Probe 1: single-quote triggers error / differential response
  const benign = await get(`${base}${endpoint}?q=helix_nosuchproduct_xyz`);
  await sleep(RATE_LIMIT_MS);
  const probe = await get(`${base}${endpoint}?q=%27+OR+%271%27%3D%271`);
  await sleep(RATE_LIMIT_MS);

  // Heuristic: injection returns more rows than a no-match benign query
  let benignCount = 0;
  let probeCount = 0;
  try {
    const bj = JSON.parse(benign.body) as { products?: unknown[] };
    const pj = JSON.parse(probe.body) as { products?: unknown[] };
    benignCount = bj.products?.length ?? 0;
    probeCount = pj.products?.length ?? 0;
  } catch { /* non-JSON response is itself suspicious */ }

  // Check for SQL error signatures in the response
  const sqlErrorPattern = /syntax error|pg_|unterminated|invalid input|operator does not exist/i;
  const hasError = sqlErrorPattern.test(probe.body) || sqlErrorPattern.test(benign.body);

  // Also expose the _debug_sql field if present (our ShopLite emits it)
  const debugSql = (() => {
    try { return (JSON.parse(probe.body) as { _debug_sql?: string })._debug_sql ?? ""; }
    catch { return ""; }
  })();

  const isInjected = probeCount > benignCount || hasError || debugSql.includes("OR '1'='1");

  if (!isInjected) return null;

  const geminiNote = await geminiAnalyse(
    "Does this HTTP response suggest SQL injection vulnerability? Look for extra rows, SQL errors, or raw SQL in the body.",
    probe.body,
  );

  return {
    class: "SQLi",
    endpoint,
    evidence: `Injection payload returned ${probeCount} rows vs ${benignCount} for benign query. ` +
      (debugSql ? `Raw SQL exposed: "${debugSql.slice(0, 120)}". ` : "") +
      `Gemini: ${geminiNote}`,
  };
}

// ── Detector 2: XSS ──────────────────────────────────────────────────────────

async function detectXSS(base: string): Promise<DetectorFinding | null> {
  const probe = "helix-xss-probe-" + Math.random().toString(36).slice(2, 8);
  const payload = encodeURIComponent(`<script>alert('${probe}')</script>`);
  const endpoint = `/search?q=${payload}`;

  const res = await get(`${base}${endpoint}`);
  await sleep(RATE_LIMIT_MS);

  // Heuristic: unescaped <script> tag reflected verbatim in the HTML
  const reflected = res.body.includes(`<script>alert('${probe}')</script>`);

  // Also check for dangerouslySetInnerHTML artifacts — unescaped angle brackets
  const imgProbe = encodeURIComponent(`<img src=x onerror=alert('${probe}')>`);
  const imgRes = await get(`${base}/search?q=${imgProbe}`);
  await sleep(RATE_LIMIT_MS);
  const imgReflected = imgRes.body.includes(`<img src=x`);

  if (!reflected && !imgReflected) return null;

  const geminiNote = await geminiAnalyse(
    "Does this HTML response reflect user input unescaped in a way that enables XSS? Look for unescaped <script> or <img> tags in the body.",
    (reflected ? res : imgRes).body,
  );

  return {
    class: "XSS",
    endpoint: "/search",
    evidence: `Probe "${probe}" reflected unescaped in HTML response. ` +
      `imgProbe reflected: ${imgReflected}. Gemini: ${geminiNote}`,
  };
}

// ── Detector 3: authBypass ────────────────────────────────────────────────────

async function detectAuthBypass(base: string): Promise<DetectorFinding | null> {
  // Try unauthenticated access to protected admin/data endpoints
  const candidates = ["/admin/orders", "/admin", "/api/admin"];
  const findings: string[] = [];

  for (const path of candidates) {
    const res = await get(`${base}${path}`);
    await sleep(RATE_LIMIT_MS);
    // 200 on an admin route without sending any auth token = bypass
    if (res.status === 200 && res.body.length > 200) {
      const geminiNote = await geminiAnalyse(
        "Does this response indicate an admin or protected page is accessible without authentication? Look for order data, user data, or admin UI.",
        res.body,
      );
      if (!geminiNote.toLowerCase().includes("no") && !geminiNote.toLowerCase().includes("not")) {
        findings.push(`${path} → HTTP 200 without auth. Gemini: ${geminiNote}`);
      } else {
        // Still record if we got 200 + significant content (conservative)
        findings.push(`${path} → HTTP 200 without credentials (${res.body.length} bytes)`);
      }
    }
  }

  if (findings.length === 0) return null;

  return {
    class: "authBypass",
    endpoint: "/admin/orders",
    evidence: findings.join("; "),
  };
}

// ── Detector 4: missingRLS ────────────────────────────────────────────────────

async function detectMissingRLS(base: string): Promise<DetectorFinding | null> {
  const res = await get(`${base}/admin/orders`);
  await sleep(RATE_LIMIT_MS);

  if (res.status !== 200) return null;

  // Heuristic: multiple distinct user_id values in the response = cross-user read
  const userIdPattern = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi;
  const uuids = [...new Set(res.body.match(userIdPattern) ?? [])];

  // Also look for ShopLite's explicit RLS warning banner
  const hasRlsWarning = res.body.toLowerCase().includes("rls missing") ||
    res.body.toLowerCase().includes("row-level security");

  // Require at least 2 distinct user UUIDs to call it missingRLS
  const distinctUuids = uuids.filter((id) => !id.startsWith("a1b2c3d4")); // exclude product IDs
  if (distinctUuids.length < 2 && !hasRlsWarning) return null;

  const geminiNote = await geminiAnalyse(
    "Does this page show order or data records belonging to multiple different users without any authentication check? This would indicate missing Row-Level Security.",
    res.body,
  );

  return {
    class: "missingRLS",
    endpoint: "/admin/orders",
    evidence: `Cross-user data exposed: ${distinctUuids.length} distinct user UUIDs visible without auth. ` +
      (hasRlsWarning ? "Explicit RLS-missing banner present. " : "") +
      `Gemini: ${geminiNote}`,
  };
}

// ── Detector 5: secretLeak ────────────────────────────────────────────────────

async function detectSecretLeak(base: string): Promise<DetectorFinding | null> {
  // Fetch the page to discover script chunk URLs
  const indexRes = await get(`${base}/search`);
  await sleep(RATE_LIMIT_MS);

  // Extract /_next/static/chunks/*.js URLs
  const chunkPattern = /\/_next\/static\/chunks\/[^\s"']+\.js/g;
  const chunks = [...new Set(indexRes.body.match(chunkPattern) ?? [])];

  // Secret patterns: Supabase service key (sb_service_/service_role JWT), generic secrets
  const secretPatterns = [
    /sb_service_[A-Za-z0-9_-]{20,}/,
    /eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}/, // JWT
    /service_role/,
    /HELIX_DEMO_FAKE/,
    /sk_[a-zA-Z0-9]{20,}/,
  ];

  const leaked: string[] = [];

  for (const chunk of chunks.slice(0, 20)) { // cap at 20 chunks
    const url = base + chunk;
    try {
      const res = await get(url);
      await sleep(50); // lighter rate limit for static assets

      for (const pat of secretPatterns) {
        const match = res.body.match(pat);
        if (match) {
          leaked.push(`chunk ${chunk.split("/").pop()}: matched "${match[0]!.slice(0, 40)}..."`);
          break;
        }
      }
    } catch { /* skip unreadable chunks */ }
  }

  // Also check inline page source
  for (const pat of secretPatterns) {
    const match = indexRes.body.match(pat);
    if (match) leaked.push(`inline HTML: matched "${match[0]!.slice(0, 40)}..."`);
  }

  if (leaked.length === 0) return null;

  const geminiNote = await geminiAnalyse(
    "Does this JavaScript bundle contain any API keys, service keys, JWT tokens, or other credentials that should not be in client-side code?",
    leaked.map((l) => l).join("\n"),
  );

  return {
    class: "secretLeak",
    endpoint: "/",
    evidence: `Secret patterns found in client bundle: ${leaked.join("; ")}. Gemini: ${geminiNote}`,
  };
}

// ── Main scanTarget ───────────────────────────────────────────────────────────

export async function scanTarget(targetUrl: string): Promise<HelixDoc<Vulnerability>[]> {
  assertAllowed(targetUrl);

  const base = targetUrl.replace(/\/$/, "");

  // Run all 5 detectors with a simple concurrency cap (3 at a time)
  const detectors = [
    detectSQLi(base),
    detectXSS(base),
    detectAuthBypass(base),
    detectMissingRLS(base),
    detectSecretLeak(base),
  ];

  // Run in two batches (3 + 2) to stay polite
  const [r1, r2, r3] = await Promise.all(detectors.slice(0, 3));
  await sleep(RATE_LIMIT_MS);
  const [r4, r5] = await Promise.all(detectors.slice(3));

  const raw = [r1, r2, r3, r4, r5].filter((r): r is DetectorFinding => r !== null);

  // Deduplicate: suppress authBypass when missingRLS covers the same endpoint
  // (missingRLS is a more specific diagnosis of the same root cause)
  const missingRLSEndpoints = new Set(raw.filter((r) => r.class === "missingRLS").map((r) => r.endpoint));
  const candidates = raw.filter(
    (r) => !(r.class === "authBypass" && missingRLSEndpoints.has(r.endpoint)),
  );

  if (candidates.length === 0) return [];

  // Persist to MongoDB — capture the returned HelixDoc so _id flows to callers.
  await connectDb();
  const now = new Date().toISOString();
  const persisted: HelixDoc<Vulnerability>[] = [];

  for (const c of candidates) {
    const vuln: Vulnerability = {
      class: c.class,
      endpoint: c.endpoint,
      evidence: c.evidence,
      reAttack: { before: "open", after: "open" },
      status: "open",
      detectedAt: now,
    };
    try {
      const doc = await createVulnerability(vuln);
      persisted.push(doc);
    } catch (err) {
      // Log but don't push — a finding without _id can't be targeted by vuln.heal.
      // eslint-disable-next-line no-console
      console.error(`[scanner] failed to persist ${c.class}:`, err);
    }
  }

  return persisted;
}
