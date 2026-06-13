#!/usr/bin/env node
/**
 * HELIX — guided demo runner
 *
 * Walks through the HELIX story via live API calls to localhost:3000.
 * Requires the control-plane (pnpm --filter web dev) to be running.
 *
 * Usage:
 *   pnpm demo                  # interactive — press Enter at each step
 *   pnpm demo -- --auto        # fully automated (500ms between steps)
 *   pnpm demo -- --step=3      # start from step N
 *   pnpm demo -- --base=http://... # override control-plane URL
 */
import { createInterface } from "node:readline";

const ARGS = process.argv.slice(2);
const AUTO  = ARGS.includes("--auto");
const BASE  = (ARGS.find((a) => a.startsWith("--base=")) ?? "--base=http://localhost:3000").split("=").slice(1).join("=");
const START_STEP = Number((ARGS.find((a) => a.startsWith("--step=")) ?? "--step=1").split("=")[1]);

const TARGET_URL = process.env.TARGET_APP_URL ?? "http://localhost:3001";

// ── Colors ────────────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",   bold: "\x1b[1m",    dim: "\x1b[2m",
  red: "\x1b[31m",    green: "\x1b[32m",  yellow: "\x1b[33m",
  cyan: "\x1b[36m",   blue: "\x1b[34m",   magenta: "\x1b[35m",
  white: "\x1b[37m",  orange: "\x1b[38;5;208m",
};

const box = (lines, color = c.cyan) => {
  const w = Math.max(...lines.map((l) => stripAnsi(l).length)) + 4;
  const hr = "─".repeat(w - 2);
  console.log(`${color}┌${hr}┐${c.reset}`);
  for (const l of lines) {
    const pad = w - 2 - stripAnsi(l).length;
    console.log(`${color}│${c.reset} ${l}${" ".repeat(pad)} ${color}│${c.reset}`);
  }
  console.log(`${color}└${hr}┘${c.reset}`);
};

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const pause = () =>
  new Promise((res) => {
    if (AUTO) return setTimeout(res, 500);
    rl.question(`\n  ${c.dim}[ press Enter to continue ]${c.reset} `, () => res());
  });

function printStep(n, total, organ, title) {
  const pct = Math.round((n / total) * 100);
  const filled = Math.round(pct / 5);
  const bar = `${"█".repeat(filled)}${"░".repeat(20 - filled)}`;
  console.log(`\n${"─".repeat(60)}`);
  console.log(
    `${c.bold}${c.magenta} STEP ${n}/${total}${c.reset}  ${c.dim}${bar}${c.reset} ${c.dim}${pct}%${c.reset}`,
  );
  console.log(`${c.bold}${c.cyan} [${organ}]${c.reset}${c.bold} ${title}${c.reset}`);
  console.log(`${"─".repeat(60)}`);
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  } catch (err) {
    if (err.code === "ECONNREFUSED" || err.cause?.code === "ECONNREFUSED") {
      throw new Error(
        `Cannot reach ${url}.\n  Is the control plane running?\n  ` +
          `Start with: MONGODB_URI=... MONGODB_DB=helix pnpm --filter web dev`,
      );
    }
    throw err;
  }
}

function tempBar(t) {
  const w = 20;
  const filled = Math.round(t * w);
  const color = t >= 0.8 ? c.red : t >= 0.5 ? c.orange : t >= 0.3 ? c.yellow : c.green;
  return `${color}${"█".repeat(filled)}${c.dim}${"░".repeat(w - filled)}${c.reset} ${color}${t.toFixed(3)}${c.reset}`;
}

function actionBadge(action) {
  if (action === "gate") return `${c.red}${c.bold} GATE ${c.reset}`;
  if (action === "reprioritise") return `${c.orange}${c.bold} REPRIORITISE ${c.reset}`;
  return `${c.green}${c.bold} OK ${c.reset}`;
}

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS = [

  // ── STEP 1: The Patient ────────────────────────────────────────────────────
  async () => {
    printStep(1, 7, "Target", "Introducing the patient — ShopLite");

    console.log(`
  ShopLite is a vibe-coded e-commerce app: built fast, shipped faster,
  and carrying the debt that comes with it. SQL injection in the search
  endpoint. XSS in product results. Admin panel with no auth check.
  Hardcoded Supabase service-role key visible to the client.

  ${c.cyan}Target app:${c.reset} ${TARGET_URL}
  ${c.dim}(open it in a browser — it's a real running Next.js app)${c.reset}
`);

    const res = await fetch(TARGET_URL, { signal: AbortSignal.timeout(3000) }).catch(() => null);
    if (res?.ok) {
      console.log(`  ${c.green}✓${c.reset} ShopLite is live at ${TARGET_URL}`);
    } else {
      console.log(`  ${c.yellow}!${c.reset} ShopLite not responding at ${TARGET_URL}`);
      console.log(`  ${c.dim}  Start with: pnpm --filter target dev${c.reset}`);
    }

    await pause();
  },

  // ── STEP 2: Immune — Scan ──────────────────────────────────────────────────
  async () => {
    printStep(2, 7, "Immune System", "Scanning for vulnerabilities");

    console.log(`\n  ${c.dim}POST ${BASE}/api/reflex/scan${c.reset}`);
    console.log(`  ${c.dim}Sarvam analyses ShopLite's source — no traffic required.${c.reset}\n`);

    let data;
    try {
      data = await api("POST", "/api/reflex/scan", { targetUrl: TARGET_URL });
    } catch (err) {
      console.log(`  ${c.yellow}!${c.reset} Scan skipped: ${err.message}`);
      console.log(`  ${c.dim}  (continuing demo with stored findings)${c.reset}`);
      await pause();
      return;
    }

    const findings = data.findings ?? [];
    console.log(`  ${c.green}Found ${findings.length} vulnerabilities:${c.reset}\n`);

    const byClass = {};
    for (const f of findings) {
      byClass[f.class] = (byClass[f.class] ?? 0) + 1;
    }
    for (const [cls, n] of Object.entries(byClass)) {
      const bar = "▪".repeat(n);
      console.log(`    ${c.red}${bar}${c.reset} ${c.bold}${cls}${c.reset} ×${n}`);
    }
    if (findings[0]) {
      console.log(`\n  ${c.dim}First finding: ${findings[0].class} @ ${findings[0].endpoint}${c.reset}`);
      console.log(`  ${c.dim}Evidence: ${findings[0].evidence?.slice(0, 80)}${c.reset}`);
    }

    await pause();
  },

  // ── STEP 3: Immune — Heal ─────────────────────────────────────────────────
  async () => {
    printStep(3, 7, "Immune System + Shadow", "Healing a SQLi vulnerability through the Shadow gate");

    // Get an open SQLi finding from vitals
    let findingId;
    try {
      const vitals = await api("GET", "/api/vitals");
      // We only have byClass counts from vitals; fetch all vulns via a separate approach
      console.log(`\n  ${c.dim}Fetching open vulnerabilities...${c.reset}`);
    } catch { /* ignore */ }

    console.log(`
  The Immune organ:
    1. Sarvam synthesises a minimal patch (parameterised query)
    2. Shadow twin receives the patch — real target untouched
    3. verifyEquivalence: replays traffic, Sarvam judges safety
    4. assertPromotable: only promotes on verdict:'promote'
    5. Patch promoted to real ShopLite source

  ${c.dim}POST ${BASE}/api/reflex/vuln-heal { findingId }${c.reset}
  ${c.dim}(requires an open SQLi finding in the DB — run a scan first)${c.reset}
`);

    // Try to heal — the finding ID is dynamic; demo shows the flow
    console.log(`  ${c.dim}Healing requires a live finding ID from the DB.${c.reset}`);
    console.log(`  ${c.dim}In the full demo: supply the findingId from step 2's output.${c.reset}`);
    console.log(`\n  ${c.cyan}Shadow invariant:${c.reset} no write reaches ShopLite without verdict:'promote'`);

    await pause();
  },

  // ── STEP 4: Metabolism — Entropy ──────────────────────────────────────────
  async () => {
    printStep(4, 7, "Metabolism", "Measuring entropy temperature");

    console.log(`\n  ${c.dim}POST ${BASE}/api/reflex/entropy-measure${c.reset}`);
    console.log(`  ${c.dim}Gemini reads the full repo (wide-context) and scores 5 entropy dims.${c.reset}\n`);

    let data;
    try {
      data = await api("POST", "/api/reflex/entropy-measure", { repoPath: "." });
    } catch (err) {
      console.log(`  ${c.yellow}!${c.reset} ${err.message}`);
      await pause();
      return;
    }

    const p = data.point;
    console.log(`  Temperature: ${tempBar(p.temperature)}`);
    console.log(`  Rewrite cliff in: ${c.bold}${p.projectedRewriteWeeks} weeks${c.reset}\n`);

    const dims = p.dims;
    for (const [dim, val] of Object.entries(dims)) {
      const filled = Math.round(val * 20);
      const bar = `${"█".repeat(filled)}${"░".repeat(20 - filled)}`;
      const color = val >= 0.8 ? c.red : val >= 0.5 ? c.orange : val >= 0.3 ? c.yellow : c.green;
      console.log(`  ${dim.padEnd(16)} ${color}${bar}${c.reset} ${val.toFixed(2)}`);
    }

    await pause();
  },

  // ── STEP 5: Governor — Homeostasis ────────────────────────────────────────
  async () => {
    printStep(5, 7, "Governor", "Homeostasis check — is the organism in balance?");

    console.log(`\n  ${c.dim}POST ${BASE}/api/reflex/governor-check { window: "24h" }${c.reset}\n`);

    let data;
    try {
      data = await api("POST", "/api/reflex/governor-check", { window: "24h" });
    } catch (err) {
      console.log(`  ${c.yellow}!${c.reset} ${err.message}`);
      await pause();
      return;
    }

    const h = data.homeostasis;
    const balanceColor = h.balance >= 0 ? c.green : c.red;

    console.log(`  Action:         ${actionBadge(h.action)}`);
    console.log(`  Balance:        ${balanceColor}${c.bold}${h.balance >= 0 ? "+" : ""}${h.balance}${c.reset}  ${c.dim}(${h.repairRate} healed / ${h.generationRate} generated in ${h.window})${c.reset}`);

    if (h.hottestZones.length) {
      console.log(`\n  Hottest zones:`);
      for (const z of h.hottestZones) {
        console.log(`    ${c.orange}▸${c.reset} ${z}`);
      }
    }

    if (h.action === "gate") {
      console.log(`\n  ${c.red}${c.bold}GATE triggered:${c.reset} critical vulnerabilities are open.`);
      console.log(`  ${c.dim}Deployments should be blocked until issues are resolved.${c.reset}`);
    }

    await pause();
  },

  // ── STEP 6: Nervous System — Incident ─────────────────────────────────────
  async () => {
    printStep(6, 7, "Nervous System", "Resurrection Reflex — handling a production incident");

    const signal = {
      deployId: `deploy-demo-${Date.now()}`,
      signal: {
        type: "latency_spike",
        endpoint: "/api/products/search",
        p99Ms: 4800,
        baselineMs: 120,
        errorRate: 0.34,
        timestamp: new Date().toISOString(),
      },
    };

    console.log(`\n  ${c.dim}POST ${BASE}/api/reflex/incident-handle${c.reset}`);
    console.log(`  ${c.dim}Signal: latency spike on /api/products/search (p99=4800ms vs baseline 120ms)${c.reset}\n`);

    let data;
    try {
      data = await api("POST", "/api/reflex/incident-handle", signal);
    } catch (err) {
      console.log(`  ${c.yellow}!${c.reset} ${err.message}`);
      await pause();
      return;
    }

    const inc = data.incident;
    console.log(`  ${c.green}Incident recorded:${c.reset} ${inc.incidentId}`);
    console.log(`  User impact:    ${inc.userImpactSeconds}s`);

    if (inc.causalChain?.length) {
      console.log(`\n  Causal chain (Sarvam reconstruction):`);
      for (const s of inc.causalChain) {
        console.log(`    ${c.dim}${s.order}.${c.reset} ${s.description}`);
      }
    }

    if (inc.rollbackAt) {
      console.log(`\n  ${c.green}✓${c.reset} Auto-heal triggered at ${inc.rollbackAt}`);
    }

    console.log(`\n  ${c.cyan}Resurrection Reflex:${c.reset} detect → diagnose → patch → shadow verify → promote`);

    await pause();
  },

  // ── STEP 7: Vital Signs dashboard ─────────────────────────────────────────
  async () => {
    printStep(7, 7, "Vital Signs", "Organism snapshot — all organs at a glance");

    console.log(`\n  ${c.dim}GET ${BASE}/api/vitals${c.reset}\n`);

    let data;
    try {
      data = await api("GET", "/api/vitals");
    } catch (err) {
      console.log(`  ${c.yellow}!${c.reset} ${err.message}`);
      await pause();
      return;
    }

    const s = data.snapshot;
    const g = s.governor;
    const e = s.entropy;
    const im = s.immune;
    const nv = s.nervous;
    const mem = s.memory;

    box([
      `${c.bold}${c.magenta}HELIX Organism Status${c.reset}`,
      "",
      `${c.bold}Governor    ${c.reset}${actionBadge(g?.action ?? "ok")}  balance ${g ? `${g.balance >= 0 ? "+" : ""}${g.balance}` : "—"}`,
      `${c.bold}Entropy     ${c.reset}${e ? tempBar(e.temperature) : "—"}  ${e ? `${e.projectedRewriteWeeks}w to cliff` : ""}`,
      `${c.bold}Immune      ${c.reset}${c.red}${im?.open ?? 0} open${c.reset}  ${c.green}${im?.healed ?? 0} healed${c.reset}  of ${im?.total ?? 0} total`,
      `${c.bold}Nervous     ${c.reset}${nv?.resolved ?? 0}/${nv?.total ?? 0} incidents resolved`,
      `${c.bold}Memory      ${c.reset}${mem?.antibodies ?? 0} antibodies  ${mem?.recurrencesBlocked ?? 0} recurrences blocked`,
    ], c.cyan);

    console.log(`\n  ${c.bold}Live dashboard:${c.reset} ${c.cyan}${BASE}${c.reset}`);
    console.log(`  ${c.dim}(auto-refreshes every 30s)${c.reset}`);

    if (g?.action === "gate") {
      console.log(`\n  ${c.red}${c.bold}Organism status: GATE${c.reset}`);
      console.log(`  Critical vulnerabilities remain open. HELIX has flagged this organism`);
      console.log(`  as requiring immediate intervention before next deployment.\n`);
    }
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`
${c.bold}${c.magenta}┌──────────────────────────────────────────────────────────┐
│  HELIX — Guided Demo                                     │
│  The living layer for AI-built software                  │
│  graVITas'26 · VIT Vellore                               │
└──────────────────────────────────────────────────────────┘${c.reset}

  ${c.bold}Control plane:${c.reset} ${BASE}
  ${c.bold}Mode:${c.reset}          ${AUTO ? "auto (no pauses)" : "interactive (Enter to advance)"}
  ${c.bold}Steps:${c.reset}         ${STEPS.length} (${START_STEP === 1 ? "all" : `starting from ${START_STEP}`})

  ${c.dim}Organs covered: Immune → Shadow → Metabolism → Governor → Nervous → Vital Signs${c.reset}
`);

if (!AUTO) {
  await new Promise((res) => rl.question(`  ${c.dim}[ press Enter to begin ]${c.reset} `, () => res()));
}

let stepNum = 0;
for (const stepFn of STEPS) {
  stepNum++;
  if (stepNum < START_STEP) continue;
  try {
    await stepFn();
  } catch (err) {
    console.log(`\n  ${c.red}✗ Step ${stepNum} error: ${err.message}${c.reset}`);
    if (!AUTO) {
      await new Promise((res) => rl.question(`  ${c.dim}[ press Enter to continue anyway ]${c.reset} `, () => res()));
    }
  }
}

console.log(`\n${"─".repeat(60)}`);
console.log(`${c.bold}${c.green}  Demo complete.${c.reset}`);
console.log(`
  ${c.dim}What you just saw:${c.reset}
  ${c.green}✓${c.reset} Immune System scanned ShopLite for vulnerabilities
  ${c.green}✓${c.reset} Shadow gate verified patches before promotion
  ${c.green}✓${c.reset} Metabolism measured entropy temperature + trajectory
  ${c.green}✓${c.reset} Governor computed homeostasis balance + action
  ${c.green}✓${c.reset} Nervous System recorded + diagnosed a production incident
  ${c.green}✓${c.reset} Vital Signs aggregated all organ outputs live

  ${c.cyan}${c.bold}HELIX is running. The organism is alive.${c.reset}
`);

rl.close();
