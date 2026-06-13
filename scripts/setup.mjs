#!/usr/bin/env node
/**
 * HELIX — one-command setup
 *
 * Usage:
 *   node scripts/setup.mjs            # full setup
 *   node scripts/setup.mjs --skip-install   # skip pnpm install
 *   node scripts/setup.mjs --skip-check     # skip typecheck
 *   node scripts/setup.mjs --seed-only      # only seed ShopLite intents
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const ARGS = new Set(process.argv.slice(2));
const SKIP_INSTALL = ARGS.has("--skip-install");
const SKIP_CHECK   = ARGS.has("--skip-check");
const SEED_ONLY    = ARGS.has("--seed-only");

// ── Colors ────────────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",  bold: "\x1b[1m",   dim: "\x1b[2m",
  red: "\x1b[31m",   green: "\x1b[32m", yellow: "\x1b[33m",
  cyan: "\x1b[36m",  blue: "\x1b[34m",  magenta: "\x1b[35m",
};
const ok   = (m) => console.log(`  ${c.green}✓${c.reset} ${m}`);
const warn = (m) => console.log(`  ${c.yellow}!${c.reset} ${m}`);
const fail = (m) => { console.error(`  ${c.red}✗ ${m}${c.reset}`); process.exit(1); };
const step = (n, m) => console.log(`\n${c.bold}${c.cyan}[${n}]${c.reset}${c.bold} ${m}${c.reset}`);
const info = (m) => console.log(`  ${c.dim}${m}${c.reset}`);

function run(cmd, opts = {}) {
  const r = spawnSync("sh", ["-c", cmd], {
    cwd: ROOT,
    stdio: opts.silent ? "pipe" : "inherit",
    encoding: "utf8",
  });
  if (r.status !== 0 && !opts.allowFail) {
    fail(`command failed: ${cmd}\n  ${r.stderr ?? ""}`);
  }
  return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function hasCmd(name) {
  return spawnSync("which", [name], { stdio: "pipe" }).status === 0;
}

// ── Banner ────────────────────────────────────────────────────────────────────

console.log(`
${c.bold}${c.magenta}┌─────────────────────────────────────────┐
│   HELIX — Setup & Initialisation        │
│   The living layer for AI-built software│
└─────────────────────────────────────────┘${c.reset}
`);

// ── Step 1: Prerequisites ─────────────────────────────────────────────────────

if (!SEED_ONLY) {
  step(1, "Checking prerequisites");

  const nodeVer = process.versions.node.split(".").map(Number);
  if (nodeVer[0] < 20) fail(`Node.js ≥ 20 required (found ${process.versions.node})`);
  ok(`Node.js ${process.versions.node}`);

  if (!hasCmd("pnpm")) fail("pnpm not found — install: npm i -g pnpm");
  const pnpmVer = run("pnpm --version", { silent: true }).stdout.trim();
  ok(`pnpm ${pnpmVer}`);

  if (!hasCmd("docker")) {
    warn("docker not found — Shadow twin will be unavailable (not required for core demo)");
  } else {
    const dockerOk = run("docker info", { silent: true, allowFail: true });
    if (!dockerOk.ok) {
      warn("Docker daemon not running — start Docker Desktop to enable Shadow twin");
    } else {
      ok("Docker daemon running");
    }
  }

  if (!hasCmd("patch")) {
    warn("patch(1) not found — promotion of diffs will fail; install via Xcode CLI tools");
  } else {
    ok("patch(1) available");
  }

  // ── Step 2: .env ──────────────────────────────────────────────────────────

  step(2, "Environment file");

  const envPath    = resolve(ROOT, ".env");
  const envExample = resolve(ROOT, ".env.example");

  if (!existsSync(envPath)) {
    copyFileSync(envExample, envPath);
    ok(".env created from .env.example");
    warn("Fill in the following keys before starting services:");
    info("  SARVAM_API_KEY    — primary LLM (required for all AI ops)");
    info("  GEMINI_API_KEY    — wide-context analysis (entropy + genome pairing)");
    info("  MONGODB_URI       — MongoDB Atlas connection string");
    info("  N8N_ENCRYPTION_KEY — openssl rand -hex 16");
    info("  NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY / SUPABASE_SERVICE_KEY — ShopLite DB");
  } else {
    ok(".env already exists");
    // Warn about obviously empty required keys
    const env = readFileSync(envPath, "utf8");
    const required = ["SARVAM_API_KEY", "MONGODB_URI", "N8N_ENCRYPTION_KEY"];
    for (const key of required) {
      const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
      if (!m || !m[1].trim()) warn(`${key} is not set — fill in .env`);
    }
  }

  // ── Step 3: Install ───────────────────────────────────────────────────────

  step(3, "Installing dependencies");

  if (SKIP_INSTALL) {
    info("skipped (--skip-install)");
  } else {
    run("pnpm install --frozen-lockfile");
    ok("dependencies installed");
  }

  // ── Step 4: Typecheck ─────────────────────────────────────────────────────

  step(4, "Type-checking");

  if (SKIP_CHECK) {
    info("skipped (--skip-check)");
  } else {
    run("pnpm -w typecheck");
    ok("all packages typecheck clean");
  }
}

// ── Step 5: Seed ShopLite intents ─────────────────────────────────────────────

step(SEED_ONLY ? 1 : 5, "Seeding ShopLite intent genome");

// Load .env manually for this process (node --env-file isn't available in all contexts)
const envPath = resolve(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

if (!process.env.MONGODB_URI) {
  warn("MONGODB_URI not set — skipping intent seeding (set it in .env and re-run)");
} else {
  info("Connecting to MongoDB and seeding ShopLite modules...");
  const r = spawnSync("pnpm", ["--filter", "engine", "seed:shoplite"], {
    cwd: ROOT,
    env: { ...process.env },
    stdio: "inherit",
    encoding: "utf8",
  });

  if (r.status !== 0) {
    warn("Intent seeding failed — check MONGODB_URI and Sarvam API key, then re-run with --seed-only");
  } else {
    ok("ShopLite intent genome seeded (5 modules)");
  }
}

// ── Step 6: Next steps ────────────────────────────────────────────────────────

if (!SEED_ONLY) {
  step(SEED_ONLY ? 2 : 6, "Next steps");

  console.log(`
${c.bold}  Start the stack (3 terminals):${c.reset}

  ${c.cyan}# Terminal 1 — ShopLite (the patient) on :3001${c.reset}
  pnpm --filter target dev

  ${c.cyan}# Terminal 2 — HELIX control plane (Vital Signs + reflexes) on :3000${c.reset}
  MONGODB_URI=\${MONGODB_URI} MONGODB_DB=helix pnpm --filter web dev

  ${c.cyan}# Terminal 3 — n8n orchestration on :5678${c.reset}
  docker compose up -d
  node --env-file=.env scripts/n8n-sync.mjs sync

${c.bold}  Shadow twin (optional, for full immune demo):${c.reset}
  docker compose -f shadow/docker-compose.yml up -d --build

${c.bold}  Run the guided demo:${c.reset}
  ${c.green}pnpm demo${c.reset}               ${c.dim}# interactive (press Enter at each step)${c.reset}
  ${c.green}pnpm demo -- --auto${c.reset}     ${c.dim}# fully automated (no pauses)${c.reset}

${c.bold}  Vital Signs dashboard:${c.reset}
  ${c.cyan}http://localhost:3000${c.reset}

${c.bold}  ShopLite target app:${c.reset}
  ${c.cyan}http://localhost:3001${c.reset}
`);

  console.log(`${c.green}${c.bold}Setup complete.${c.reset}\n`);
}
