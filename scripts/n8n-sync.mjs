#!/usr/bin/env node
/**
 * HELIX — n8n workflow-as-code sync (Public API).
 *
 * Treats orchestration/n8n/workflows/*.json as the source of truth and pushes
 * them to an n8n instance over the Public API (https://docs.n8n.io/api/).
 * Idempotent: upserts by workflow `name` (PUT if it exists, POST otherwise),
 * then activates. Re-running is safe.
 *
 * Instance-agnostic — works against either a self-hosted instance
 * (http://localhost:5678) or n8n cloud (https://<you>.app.n8n.cloud). The key
 * must belong to the SAME instance N8N_API_URL points at: a cloud Public API
 * key does NOT authenticate against a self-hosted instance, and vice versa.
 *
 * Auth: header `X-N8N-API-KEY` (verified against n8n's published OpenAPI spec).
 * Base path: `${N8N_API_URL}/api/v1`.
 *
 * Usage (env loaded via `node --env-file=.env`):
 *   node --env-file=.env scripts/n8n-sync.mjs ping     # verify URL + key
 *   node --env-file=.env scripts/n8n-sync.mjs list     # list remote workflows
 *   node --env-file=.env scripts/n8n-sync.mjs sync     # upsert + activate all
 *
 * Env:
 *   N8N_API_URL              instance base URL (default http://localhost:5678)
 *   N8N_API_KEY              Public API key for THAT instance (required)
 *   HELIX_PUBLIC_API_BASE    optional: if set, rewrites control-plane calls
 *                            from http://host.docker.internal:3000 to this URL
 *                            (used when the n8n instance can't reach the host,
 *                            e.g. cloud n8n → a tunnel exposing localhost:3000)
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const WORKFLOWS_DIR = join(REPO_ROOT, "orchestration", "n8n", "workflows");

// Accept the base with or without a trailing /api or /api/v1 — we append it.
const API_URL = (process.env.N8N_API_URL || "http://localhost:5678")
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "")
  .replace(/\/api$/, "");
const API_KEY = process.env.N8N_API_KEY || "";
const PUBLIC_API_BASE = (process.env.HELIX_PUBLIC_API_BASE || "").replace(/\/+$/, "");

// The control-plane host n8n calls by default (self-hosted Docker reaches the
// host via host.docker.internal). Rewritten only when HELIX_PUBLIC_API_BASE set.
const CONTROL_PLANE_DEFAULT = "http://host.docker.internal:3000";

// The Public API's workflowCreate/update schema is `additionalProperties:false`
// and accepts exactly these top-level keys. Anything else → HTTP 400.
const ALLOWED_KEYS = ["name", "nodes", "connections", "settings"];

const c = {
  reset: "\x1b[0m", red: "\x1b[31m", green: "\x1b[32m",
  yellow: "\x1b[33m", cyan: "\x1b[36m", dim: "\x1b[2m",
};
const log = (...a) => console.log(...a);
const ok = (m) => log(`${c.green}✓${c.reset} ${m}`);
const warn = (m) => log(`${c.yellow}!${c.reset} ${m}`);
const die = (m) => { console.error(`${c.red}✗ ${m}${c.reset}`); process.exit(1); };

/** Call the n8n Public API. Throws a readable error on non-2xx. */
async function api(method, path, body) {
  const url = `${API_URL}/api/v1${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "X-N8N-API-KEY": API_KEY,
        ...(body ? { "Content-Type": "application/json" } : {}),
        accept: "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    throw new Error(
      `cannot reach ${url} — is the n8n instance running and N8N_API_URL correct?\n  (${e.message})`,
    );
  }

  if (res.status === 401) {
    throw new Error(
      `401 Unauthorized from ${API_URL}.\n` +
        `  The API key does not match this instance. A cloud Pro key only works\n` +
        `  against your cloud URL; a self-hosted instance needs a key generated in\n` +
        `  its own UI (Settings → n8n API). Check N8N_API_URL + N8N_API_KEY pair up.`,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** Strip a workflow to the keys the Public API accepts, applying URL rewrite. */
function toPayload(raw) {
  let wf = raw;
  if (PUBLIC_API_BASE) {
    wf = JSON.parse(
      JSON.stringify(raw).split(CONTROL_PLANE_DEFAULT).join(PUBLIC_API_BASE),
    );
  }
  const payload = {};
  for (const k of ALLOWED_KEYS) {
    if (wf[k] !== undefined) payload[k] = wf[k];
  }
  // settings is required by the API; default to a safe value if a file omits it.
  if (payload.settings === undefined) payload.settings = { executionOrder: "v1" };
  return payload;
}

/** GET all remote workflows, following the cursor pagination. */
async function listRemote() {
  const all = [];
  let cursor;
  do {
    const q = cursor ? `?limit=100&cursor=${encodeURIComponent(cursor)}` : "?limit=100";
    const page = await api("GET", `/workflows${q}`);
    all.push(...(page.data ?? []));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return all;
}

async function loadLocal() {
  let entries;
  try {
    entries = await readdir(WORKFLOWS_DIR);
  } catch {
    die(`workflows dir not found: ${WORKFLOWS_DIR}`);
  }
  const files = entries.filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) die(`no *.json workflows in ${WORKFLOWS_DIR}`);
  const out = [];
  for (const f of files) {
    const raw = JSON.parse(await readFile(join(WORKFLOWS_DIR, f), "utf8"));
    if (!raw.name) die(`${f}: workflow has no "name" — required by the Public API`);
    out.push({ file: f, raw });
  }
  return out;
}

function requireKey() {
  if (!API_KEY) {
    die(
      `N8N_API_KEY is not set.\n` +
        `  Self-hosted: open ${API_URL} → Settings → n8n API → create an API key.\n` +
        `  Cloud:       open your cloud instance → Settings → n8n API.`,
    );
  }
}

// ── commands ──────────────────────────────────────────────────────────────────

async function cmdPing() {
  requireKey();
  const remote = await listRemote();
  ok(`reachable: ${API_URL}/api/v1 — ${remote.length} workflow(s) on this instance`);
  if (PUBLIC_API_BASE) log(`${c.dim}  URL rewrite active → ${PUBLIC_API_BASE}${c.reset}`);
}

async function cmdList() {
  requireKey();
  const remote = await listRemote();
  if (remote.length === 0) return warn("no workflows on this instance yet");
  for (const w of remote) {
    const state = w.active ? `${c.green}active${c.reset}` : `${c.dim}inactive${c.reset}`;
    log(`  ${state}  ${c.cyan}${w.id}${c.reset}  ${w.name}`);
  }
}

async function upsertAll({ activate }) {
  requireKey();
  log(`${c.dim}target: ${API_URL}${PUBLIC_API_BASE ? `  (rewrite → ${PUBLIC_API_BASE})` : ""}${c.reset}\n`);

  const local = await loadLocal();
  const remote = await listRemote();
  const byName = new Map(remote.map((w) => [w.name, w]));

  for (const { file, raw } of local) {
    const payload = toPayload(raw);
    const existing = byName.get(raw.name);
    let id;
    try {
      if (existing) {
        await api("PUT", `/workflows/${existing.id}`, payload);
        id = existing.id;
        ok(`updated  ${c.cyan}${id}${c.reset}  ${raw.name}  ${c.dim}(${file})${c.reset}`);
      } else {
        const created = await api("POST", "/workflows", payload);
        id = created.id;
        ok(`created  ${c.cyan}${id}${c.reset}  ${raw.name}  ${c.dim}(${file})${c.reset}`);
      }
      if (activate) {
        await api("POST", `/workflows/${id}/activate`);
        log(`         ${c.green}↳ activated${c.reset}`);
      }
    } catch (e) {
      die(`${file}: ${e.message}`);
    }
  }
  const verb = activate ? "synced & activated" : "pushed (inactive)";
  log(`\n${c.green}done — ${local.length} workflow(s) ${verb}.${c.reset}`);
  if (!activate) {
    log(`${c.dim}  activate in the n8n UI, or run with the activate step, once the${c.reset}`);
    log(`${c.dim}  control plane is reachable from this instance.${c.reset}`);
  }
}

const cmdSync = () => upsertAll({ activate: true });
const cmdPush = () => upsertAll({ activate: false });

const cmd = process.argv[2] || "sync";
const commands = { ping: cmdPing, list: cmdList, push: cmdPush, sync: cmdSync };
const run = commands[cmd];
if (!run) die(`unknown command "${cmd}" — use: ping | list | push | sync`);
run().catch((e) => die(e.message));
