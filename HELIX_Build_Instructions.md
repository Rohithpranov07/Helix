# HELIX — Complete Build Instructions for Claude Code
### Drift-proof, hallucination-resistant prompts aligned 1:1 to the Technical Deep-Dive v1.0

> **Purpose.** This document builds HELIX *exactly* as specified in the Technical Deep-Dive. Every task cites the deep-dive section it implements and copies its **data model verbatim** as the contract. Follow the tasks in order. Do not skip the **§A Operating Contract** or **§B Canonical Specifications** — they are what keep Claude Code from hallucinating, erroring, or drifting.
>
> **Alignment guarantee.** The organs, data models, stack mappings, and demo moments below are transcribed directly from the uploaded deep-dive (Genome §3, Immune System §4, Immune Memory §5, Metabolism §6, Nervous System/Resurrection §7, Shadow §8, Governor §9, Vital Signs §10). If any prompt seems to disagree with the deep-dive, the **deep-dive wins** — stop and reconcile.

---

# §A. Operating Contract — paste this into `CLAUDE.md` first

> This is the single most important section. It is the standing instruction set for **every** Claude Code session on this repo. Put it verbatim at the top of `CLAUDE.md`.

```md
# HELIX — Claude Code Operating Contract (READ EVERY SESSION)

## What HELIX is
HELIX is an autonomous "living layer" for AI-built software. It keeps software
aligned to intent, secure, self-healing, and free of entropy — modelled as an
organism with organs: Genome, Immune System, Immune Memory, Metabolism,
Nervous System / Resurrection Reflex, Shadow, Governor, Vital Signs.
The unifying thesis: intent drift, code drift, vulnerabilities, production
failures, and entropy are ONE phenomenon — divergence over time.

## GROUND TRUTH (never change without explicit human instruction)
- Architecture, organ responsibilities, data models, and the sponsor-stack
  mapping are FIXED by the Technical Deep-Dive. Do not redesign them.
- Sponsor stack ownership is fixed:
  - Gemini  = Perception (wide-context reads, log/UI parsing).
  - Sarvam  = Cognition + voice (reasoning, patch synthesis, drift judgement,
              Bulbul TTS, Saaras STT). Default reasoning provider.
  - MongoDB = Biology/memory (intent genome, vector antibody library,
              entropy time-series, incident & proof records).
  - n8n     = Autonomic wiring (reflex arcs, scheduled loops).
- Boundaries: organ logic lives ONLY in packages/engine; ALL AI calls go ONLY
  through packages/ai; ALL DB access goes ONLY through packages/db; shared
  types live ONLY in packages/shared and are imported, never redefined.

## ANTI-HALLUCINATION RULES (hard rules)
1. Never invent API endpoints, request/response shapes, SDK method names, or
   package APIs. Before using ANY external API (Sarvam, Gemini, MongoDB driver,
   Supabase, n8n), open and read its official docs IN THIS SESSION and confirm
   the exact shapes. If you cannot verify, STOP and ask — do not guess.
2. Never assume a package or version exists. Check package.json / the registry
   before importing. Pin the resolved version; commit the lockfile.
3. If a value, type, or contract already exists in packages/shared or §B of the
   build doc, IMPORT it. Never create a second definition of the same concept.
4. If a requirement is ambiguous or underspecified, ask ONE clarifying question
   instead of assuming. State any unavoidable assumption explicitly in the PR.
5. Do not fabricate test results, file contents, or command output. Run things.

## ANTI-DRIFT RULES (hard rules)
6. Only create/modify the files listed in the task's "Files you may touch".
   If you must touch another file, list it and explain BEFORE editing.
7. Do not refactor unrelated code. Do not add features not in the task.
   Do not "improve" architecture beyond the task scope.
8. Keep every organ's data model byte-aligned with §B. Field names and enums
   must match exactly (e.g. class is 'SQLi'|'XSS'|'authBypass'|'secretLeak'
   |'missingRLS' — not synonyms).

## QUALITY GATES (must hold at end of every task)
- TypeScript strict; no `any` (use `unknown` + narrow). No secrets in code.
- Zod validates ALL external input and ALL AI JSON output at the boundary.
- Every organ action is idempotent and writes an auditable record to MongoDB.
- Errors are typed and structured; never swallow errors silently.
- No write ever reaches the real target/production without a Shadow proof
  (verdict:'promote'). This is the Shadow invariant — it is inviolable.

## WORKING METHOD (every task)
A. First output a SHORT PLAN: the files you'll create/modify and the approach.
   For any task touching >1 file, WAIT for "go" before writing (unless told to
   run autonomously). 
B. Implement only what the task asks.
C. Run the task's VERIFY commands. Paste real output. If anything fails, fix it
   before claiming done. Do NOT mark done on unverified work.
D. Extend tests. New behaviour ships with a test.
E. Commit once, message: `feat(<TASKID>): <summary>` (or fix/chore as apt).

## DEFINITION OF DONE
A task is done only when: code compiles (pnpm -w typecheck), lints
(pnpm -w lint), its VERIFY block passes with pasted output, tests pass, the
data model matches §B exactly, and only the permitted files changed.
```

---

# §B. Canonical Specifications (single source of truth)

> Every task imports from here. These are transcribed from the deep-dive's data models. **Do not paraphrase field names.**

## B.1 Environment variables (`.env.example`)

```
# ---- AI (Cognition + Perception) ----
SARVAM_API_KEY=
GEMINI_API_KEY=
HELIX_SOVEREIGN=0           # 1 = route reasoning to local open-weight endpoint
HELIX_SOVEREIGN_BASE=       # used when HELIX_SOVEREIGN=1
EMBEDDING_PROVIDER=gemini   # gemini | sarvam | local — isolate behind embed()

# ---- Biology / memory ----
MONGODB_URI=
MONGODB_DB=helix

# ---- Target (the "patient") + Shadow ----
TARGET_APP_URL=http://localhost:3001
SHADOW_APP_URL=http://localhost:3002
TARGET_ALLOWLIST=http://localhost:3001,http://localhost:3002   # scanner gate

# ---- Supabase (target backend) ----
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# ---- Orchestration + control plane ----
N8N_WEBHOOK_BASE=http://localhost:5678/webhook
HELIX_API_BASE=http://localhost:3000
```

## B.2 Domain types — `packages/shared/src/types.ts` (authoritative)

> These names/enums are the contract. Zod schemas in B.3 mirror them 1:1.

```ts
// ----- enums -----
export type VulnClass = 'SQLi' | 'XSS' | 'authBypass' | 'secretLeak' | 'missingRLS';
export type VulnStatus = 'open' | 'patching' | 'healed';
export type AntibodySource = 'vuln' | 'incident';
export type ShadowVerdict = 'promote' | 'reject';
export type GovernorAction = 'ok' | 'reprioritise' | 'gate';

// ----- Genome §3 : intent_strand -----
export interface Invariant { id: string; rule: string; rationale: string; compliance?: boolean; }
export interface IntentStrand {
  moduleId: string;
  purpose: string;
  invariants: Invariant[];
  edgeDecisions: string[];
  sourcePrompt: string;
  generatedBy: { model: string; version: string };
  pairing: { score: number; lastChecked: string; unpairedInvariants: string[] };
}

// ----- Immune System §4 : vulnerability -----
export interface Vulnerability {
  class: VulnClass;
  endpoint: string;
  evidence: string;
  patchRef?: string;
  reAttack: { before: 'open' | 'closed'; after: 'open' | 'closed' };
  antibodyId?: string;
  status: VulnStatus;
  detectedAt: string;
  healedAt?: string;
}

// ----- Immune Memory §5 : antibody (vector-indexed) -----
export interface Antibody {
  antibodyId: string;
  sourceType: AntibodySource;
  signature: string;
  embedding: number[];
  regressionTest: string;
  runtimeAssertion: string;
  mintedAt: string;
  recurrencesBlocked: number;
}

// ----- Metabolism §6 : entropy_timeseries (time-series collection) -----
export interface EntropyPoint {
  ts: string;
  temperature: number;
  dims: { duplication: number; patternVariance: number; coupling: number; vulnDensity: number; comprehension: number };
  projectedRewriteWeeks: number;
}

// ----- Nervous System / Resurrection §7 : incident -----
export interface CausalStep { order: number; description: string; evidenceRef: string; }
export interface Incident {
  incidentId: string;
  deployId: string;
  detectedAt: string;
  baselineDelta: number;
  rollbackAt?: string;
  causalChain: CausalStep[];
  failingRequest: unknown;
  shadowProof?: string;     // proofId
  fixRef?: string;
  antibodyId?: string;
  userImpactSeconds: number;
}

// ----- Shadow §8 : shadow_proof -----
export interface ShadowProof {
  proofId: string;
  changeRef: string;
  replayedCases: number;
  intendedFixPassed: boolean;
  regressions: number;
  verdict: ShadowVerdict;
  verifiedAt: string;
}

// ----- Governor §9 : homeostasis -----
export interface Homeostasis {
  window: string;
  generationRate: number;
  repairRate: number;
  balance: number;
  action: GovernorAction;
  hottestZones: string[];
}
```

## B.3 Reflex webhook contracts — `packages/shared/src/contracts.ts`

> n8n calls the control plane through these. Each has a Zod request + response schema. The engine implements one function per reflex.

```
scan.run        req { targetUrl }                       res { findings: Vulnerability[] }
vuln.heal       req { findingId }                        res { vulnerability: Vulnerability, proof?: ShadowProof }
incident.handle req { deployId, signal }                 res { incident: Incident }
genome.pair     req { moduleId }                         res { strand: IntentStrand, mismatches: string[] }
entropy.measure req { repoPath }                         res { point: EntropyPoint }
```

## B.4 MongoDB collections (exact names)

`intent_strand` · `vulnerability` · `antibody` (vector index on `embedding`) · `entropy_timeseries` (time-series) · `incident` · `shadow_proof` · `homeostasis`

## B.5 Repo structure (fixed)

```
helix/
├── apps/web/                 # Next.js 15 control plane + Vital Signs (port 3000)
├── apps/target/              # vulnerable demo app "ShopLite" (port 3001)
├── packages/shared/          # types + contracts (B.2, B.3) — import only
├── packages/db/              # Mongoose models, Zod, repos, vector index
├── packages/ai/              # Sarvam + Gemini clients (chat, embed, TTS, STT)
├── packages/engine/          # organs: scanner, healer, reflex, genome, metabolism, shadow, governor
├── shadow/                   # Shadow twin runtime (Docker, port 3002)
├── orchestration/n8n/        # docker-compose + exported workflows
├── scripts/                  # setup + demo orchestration
├── CLAUDE.md
├── docker-compose.yml
└── README.md
```

## B.6 Pinned stack (confirm latest compatible, then lock)

pnpm + Turborepo · Next.js 15 (App Router) · React 19 · TypeScript 5 (strict) · Tailwind CSS v4 · shadcn/ui · MongoDB Atlas + Atlas Vector Search · Mongoose 8 + Zod · n8n (Docker) · Supabase (Postgres + RLS) · Docker Compose. **Instruction to Claude Code:** confirm the latest mutually-compatible versions at install time, pin the exact resolved versions in each `package.json`, commit the lockfile, and do not bump versions across tasks.

---

# §C. How these prompts prevent the three failure modes

| Failure mode | The mechanism in this doc that prevents it |
|---|---|
| **Hallucination** | Anti-hallucination rules 1–5 force doc-verification of every external API and forbid inventing shapes; §B fixes all types so nothing is improvised. |
| **Errors** | Every task ends with a **VERIFY** block of exact commands + expected output; Definition of Done blocks progress on unverified work; tests ship with behaviour. |
| **Drift** | Each task lists **exact files you may touch**; data models are copied verbatim from the deep-dive; §A boundaries keep organs/AI/DB separated; "deep-dive wins" tie-breaker. |

---

# §D. The Build — task-by-task prompts

> **Task anatomy.** Each task has: a header (ID · deep-dive ref · priority · depends-on), then a single **PROMPT** block to paste into Claude Code. The prompt is self-contained: it states the goal, the exact files it may touch, the verbatim data model where relevant, the implementation requirements, explicit *do-NOTs*, and an embedded **VERIFY** block. Priorities: **[P0]** demo-critical · **[P1]** fast-follow · **[P2]** vision. Do all **[P0]** in order first.

---

## PHASE 0 — Foundation

### T0.0 · Operating Contract & context — `CLAUDE.md` · [P0] · depends: none

> **PROMPT**
> Create `CLAUDE.md` at the repo root. Paste into it, verbatim, the "HELIX — Claude Code Operating Contract" block from §A of the build instructions (I will provide it). Then append a short "Project map" section listing the repo structure from §B.5 and the canonical collection names from §B.4. Do not add anything beyond what §A and §B specify. Output the final file and confirm it contains the GROUND TRUTH, ANTI-HALLUCINATION, ANTI-DRIFT, QUALITY GATES, WORKING METHOD, and DEFINITION OF DONE headings.
> **VERIFY:** print `CLAUDE.md`; confirm all six contract headings are present.

---

### T0.1 · Monorepo scaffold · [P0] · depends: T0.0

> **PROMPT**
> Goal: a buildable pnpm-workspace + Turborepo monorepo named `helix` exactly matching §B.5.
> Files you may touch: repo root config files, and create empty package skeletons for `packages/shared`, `packages/db`, `packages/ai`, `packages/engine`, `apps/web`, `apps/target`. Do NOT implement organ logic yet.
> Requirements:
> 1. Confirm latest mutually-compatible versions of the §B.6 stack at install time; pin exact resolved versions; commit `pnpm-lock.yaml`.
> 2. Root `package.json` with pnpm workspaces + Turborepo pipeline: `dev`, `build`, `lint`, `typecheck`.
> 3. `tsconfig.base.json` with `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Every package extends it.
> 4. ESLint (typescript-eslint, `no-explicit-any` as error) + Prettier.
> 5. Scaffold `apps/web` as Next.js 15 App Router + TS + Tailwind v4 + shadcn/ui (init shadcn), placeholder page, runs on port 3000.
> 6. Create `.env.example` exactly as §B.1. Create `.gitignore` (node, next, env, docker volumes). Root `README.md` stub.
> Do NOT add any dependency not needed for the above.
> **VERIFY:** run and paste output of `pnpm install`, `pnpm -w typecheck`, `pnpm -w build`, `pnpm -w lint`; then `pnpm --filter web dev` and confirm a page serves on :3000.

---

### T0.2 · Shared types & contracts — `packages/shared` · [P0] · depends: T0.1

> **PROMPT**
> Goal: the single source of truth for all domain types and reflex contracts.
> Files you may touch: `packages/shared/**` only.
> Requirements:
> 1. Create `src/types.ts` containing EXACTLY the interfaces and unions from §B.2 of the build instructions (I will provide them). Do not rename fields or change enum members.
> 2. Create `src/contracts.ts`: for each reflex in §B.3 (`scan.run`, `vuln.heal`, `incident.handle`, `genome.pair`, `entropy.measure`) export a Zod request schema and a Zod response schema, plus inferred TS types. The response schemas must reuse the domain types (e.g. `vuln.heal` response references the `Vulnerability` shape).
> 3. Create `src/errors.ts`: a typed error hierarchy — `HelixError` base with `code`, plus `VerificationError`, `AuthorizationError`, `ExternalApiError`, `ValidationError`.
> 4. Barrel-export everything from `src/index.ts`.
> Do NOT add Mongoose, network, or AI code here — this package is types only.
> **VERIFY:** `pnpm --filter shared typecheck`; add a tiny test that parses a valid and an invalid `scan.run` request through its Zod schema and asserts pass/fail; run `pnpm --filter shared test`.

---

### T0.3 · Data layer — `packages/db` · [P0] · depends: T0.2

> **PROMPT**
> Goal: MongoDB persistence for all §B.4 collections, models byte-aligned to §B.2.
> Files you may touch: `packages/db/**` only. Import types from `@helix/shared` — do NOT redefine them.
> Requirements:
> 1. `src/connect.ts`: singleton Mongoose connection from `MONGODB_URI`/`MONGODB_DB`, with connection reuse and typed errors (`ExternalApiError` on failure).
> 2. One Mongoose schema+model per collection, names EXACTLY: `intent_strand`, `vulnerability`, `antibody`, `entropy_timeseries`, `incident`, `shadow_proof`, `homeostasis`. `entropy_timeseries` MUST be a Mongo **time-series collection** (timeField `ts`). Each schema's fields must match the corresponding §B.2 interface exactly.
> 3. Typed repository functions per collection (`create`, `findById`, `update`, `list`) returning the `@helix/shared` types. Validate inputs with the matching Zod schema before write.
> 4. `scripts/createVectorIndex.ts`: create an Atlas Vector Search index named `antibody_vec` on `antibody.embedding` (confirm exact Atlas index-definition syntax from current MongoDB docs before writing — do not guess the JSON shape).
> 5. `scripts/seed.ts`: insert one sample doc per collection using realistic values.
> Do NOT access these collections from anywhere outside this package later.
> **VERIFY:** `pnpm --filter db typecheck`; with a real `MONGODB_URI`, run `seed.ts` and print inserted ids; run `createVectorIndex.ts` and print the index status; confirm `entropy_timeseries` is created as time-series via a `db.getCollectionInfos` check.

---

### T0.4 · AI clients — `packages/ai` · [P0] · depends: T0.2

> **PROMPT**
> Goal: typed Cognition (Sarvam) + Perception (Gemini) layer, the ONLY place AI is called.
> Files you may touch: `packages/ai/**` only.
> CRITICAL anti-hallucination step: before writing any client, open the CURRENT Sarvam API docs and the CURRENT Gemini API docs in this session and confirm exact endpoints, auth headers, request bodies, and response shapes for: Sarvam chat/completion, Sarvam Bulbul TTS, Sarvam Saaras STT, Gemini generateContent, and embeddings. Do NOT invent any of these. If a shape can't be confirmed, STOP and tell me.
> Requirements:
> 1. `sarvam.chat({ system, messages, json? })`: reasoning + patch generation. If `json` (a Zod schema) is passed, instruct strict-JSON output, strip code fences, parse, validate against the schema, and retry ONCE on failure; throw `ExternalApiError`/`ValidationError` on final failure.
> 2. `sarvam.tts(text, { language })` (Bulbul) → audio buffer/url. `sarvam.stt(audio)` (Saaras) → transcript.
> 3. `gemini.analyze({ parts, json? })`: long-context perception (file bundles, logs, DOM) with the same strict-JSON option.
> 4. `embed(text)`: provider-isolated embeddings selected by `EMBEDDING_PROVIDER`.
> 5. `reason(args)`: provider abstraction that routes to Sarvam by default, or to the local open-weight endpoint when `HELIX_SOVEREIGN=1` (`HELIX_SOVEREIGN_BASE`).
> 6. Retry/backoff, timeouts, structured errors. No secrets logged.
> 7. `examples/` script that calls each function once against real keys and prints results.
> Do NOT implement organ logic here; this is transport + validation only.
> **VERIFY:** run `examples/` and paste each call's result; demonstrate JSON-mode validating against a Zod schema; confirm `tts` returns playable audio bytes; confirm sovereign routing flips with the env flag.

---

### T0.5 · Orchestration & reflex handlers — `orchestration/n8n` + `apps/web/api/reflex` · [P0] · depends: T0.2

> **PROMPT**
> Goal: n8n running locally + typed reflex endpoints the engine will fill in.
> Files you may touch: `orchestration/n8n/**`, `apps/web/app/api/reflex/**`, root `docker-compose.yml`.
> Requirements:
> 1. `orchestration/n8n/docker-compose.yml`: run n8n with a persistent volume and basic auth from env. Confirm the current n8n image + required env from n8n docs before writing.
> 2. Root `docker-compose.yml`: bring up n8n (and a local MongoDB if no Atlas URI) together.
> 3. In `apps/web`, add route handlers `app/api/reflex/scan/route.ts`, `.../vuln-heal/route.ts`, `.../incident-handle/route.ts`, `.../genome-pair/route.ts`, `.../entropy-measure/route.ts`. Each: validate the request with the matching Zod contract from `@helix/shared`, call the corresponding `@helix/engine` function (import a stub for now), return the typed response; reject invalid payloads with 400 + `ValidationError`.
> 4. `orchestration/n8n/README.md`: how n8n calls `HELIX_API_BASE/api/reflex/*`.
> Do NOT implement organ logic; handlers call engine stubs.
> **VERIFY:** `docker compose up` starts n8n (paste the URL); POST a valid and an invalid payload to each reflex route and paste status + body (valid → typed stub; invalid → 400).

---

## PHASE 1 — The Patient (so the Immune System has a real target)

### T1.1 · Vulnerable demo app "ShopLite" — `apps/target` · [P0] · depends: T0.1

> **PROMPT**
> Goal: a controlled, clearly-bounded vulnerable app for AUTHORIZED self-testing only, so the Immune System (§4) can find and heal real issues on stage.
> Files you may touch: `apps/target/**` only.
> Build a minimal Next.js + Supabase store "ShopLite" (login, product search, admin orders) on port 3001. Intentionally include EXACTLY these four issues, each marked with a top-of-file banner `// HELIX-DEMO-VULN: intentionally insecure for authorized self-testing`:
> 1. **SQLi** in a product-search endpoint (raw string-concatenated SQL).
> 2. **Reflected XSS** in search results render.
> 3. **missingRLS** on `orders` (any user can read others' orders).
> 4. **secretLeak**: a Supabase service key referenced in client-side code (use a fake placeholder key, never a real secret).
> Provide Supabase migrations + seed (products, users, orders). Export `apps/target/vulns.manifest.json` listing each planted vuln `{ class, endpoint, expectedDetection }` matching the §B.2 `VulnClass` enum exactly — this is ground truth for scoring the scanner. Add a README documenting each issue and its correct fix.
> Do NOT add any vulnerability class beyond the four; do NOT include real secrets.
> **VERIFY:** app runs on :3001; reproduce each of the four issues locally and paste evidence; print `vulns.manifest.json` and confirm the four `class` values are from the enum.

---

## PHASE 2 — Immune System (§4) + Immune Memory (§5)  ← the wedge, "Build fully"

> Deep-dive §4 flow is fixed: **Attach by URL → continuous red-team → generate patch (Sarvam) → heal in Shadow then re-attack → mint antibody.** Data model is the `vulnerability` collection (verbatim in §B.2). Demo moment: *find a real SQLi, patch in Shadow, re-attack, confirm closed, mint antibody — under a minute.*

### T2.1 · Adversarial scanner (attach by URL) — `packages/engine` · [P0] · depends: T0.3,T0.4,T1.1

> **PROMPT**
> Goal: implement the §4 "continuous red-team" detection for the five `VulnClass` values, as a DEFENSIVE DAST module restricted to authorized targets.
> Files you may touch: `packages/engine/src/immune/scanner.ts`, its tests, and `packages/engine/src/index.ts` (export only). Import types from `@helix/shared`, DB from `@helix/db`, AI from `@helix/ai`.
> Requirements:
> 1. `scanTarget(targetUrl): Promise<Vulnerability[]>`. FIRST enforce an authorization gate: reject any URL not in `TARGET_ALLOWLIST` with `AuthorizationError`. This gate is mandatory.
> 2. Detectors for `SQLi`, `XSS`, `authBypass`, `missingRLS`, `secretLeak` using standard OWASP-style, minimal, detection-focused vectors — non-destructive and read-only (never mutate target data). Use `gemini.analyze` to recognise subtle signatures in responses/DOM/errors (per §4 stack mapping: "Gemini parses responses/DOM/errors").
> 3. Each detector returns a candidate `{ class, endpoint, evidence }`; persist to the `vulnerability` collection via `@helix/db` with `status:'open'`, `detectedAt`, and `reAttack:{before:'open',after:'open'}`.
> 4. Concurrency limit, per-request timeout, polite rate-limiting.
> 5. Wire into the `scan.run` reflex handler (replace the stub).
> 6. CLI `pnpm --filter engine scan --url=$TARGET_APP_URL` that prints findings and, if the target is ShopLite, a precision/recall summary vs `vulns.manifest.json`.
> Do NOT add weaponized exploits or any capability to attack non-allow-listed hosts.
> **VERIFY:** run the CLI against ShopLite; paste findings; confirm all four planted vulns detected with zero unconfirmed false positives in the scored run; confirm a non-allow-listed URL is rejected.

### T2.2 · Finding confirmation (exploit reproduction) — `packages/engine` · [P0] · depends: T2.1

> **PROMPT**
> Goal: never act on a guess — confirm each finding is genuinely exploitable before any patch.
> Files you may touch: `packages/engine/src/immune/confirm.ts` + tests + engine index export.
> Requirements: `confirmFinding(finding): Promise<boolean>` reproduces each class non-destructively: SQLi → controlled differential response; XSS → payload reflects unescaped; missingRLS → cross-user read proven; secretLeak → key reachable. Store reproduction evidence on the `vulnerability` doc. Discard unconfirmed candidates. All reproduction strictly read-only.
> **VERIFY:** unit tests on ShopLite show only genuinely exploitable findings survive; paste the stored evidence for the SQLi; confirm no target data was mutated.

### T2.3 · Patch synthesis + Shadow apply — `packages/engine` · [P0] · depends: T2.2, T4.1

> **PROMPT**
> Goal: §4 "generate the patch (Sarvam) + heal in the Shadow".
> Files you may touch: `packages/engine/src/immune/patch.ts` + tests + engine index.
> Requirements:
> 1. `synthesizePatch(finding): Promise<{ files:{path:string,diff:string}[], rationale:string }>` via `sarvam.chat` in strict-JSON mode (Zod-validated): class-appropriate minimal fixes — parameterized queries (SQLi), output-encoding (XSS), RLS policy on `orders` (missingRLS), server-side key handling (secretLeak).
> 2. `applyInShadow(patch)` applies it to the Shadow twin (from T4.1) — NEVER to the real target. Set `vulnerability.status:'patching'`, store `patchRef`.
> 3. Guardrail: reject patches touching files outside the target app or exceeding a size threshold (`ValidationError`).
> Do NOT write to the real target here.
> **VERIFY:** for each confirmed ShopLite vuln a sensible patch is produced and applied to the Shadow; paste each diff; confirm the real target is untouched.

### T2.4 · Re-attack confirmation + promote — `packages/engine` · [P0] · depends: T2.3, T4.2, T3.1

> **PROMPT**
> Goal: §4 "re-attack; only a fix that demonstrably closes the hole is promoted" + mint antibody.
> Files you may touch: `packages/engine/src/immune/heal.ts` + tests + engine index; wire `vuln.heal` reflex.
> Requirements:
> 1. `healVulnerability(findingId)`: orchestrate confirm → synthesize → applyInShadow → **re-run the identical attack from T2.1/T2.2 against the Shadow** → require the attack now returns `closed` AND no other detector newly fires.
> 2. On success: call `verifyEquivalence` (T4.2) to record a `shadow_proof`; only on `verdict:'promote'` promote the patch (for demo, "promote" = write fix to the target checkout / open a PR). Set `status:'healed'`, `reAttack:{before:'open',after:'closed'}`, `healedAt`, and call `mintAntibody` (T3.1) to set `antibodyId`.
> 3. On failure: keep target unchanged, mark patch rejected, retry synthesis up to N times, then escalate.
> 4. Emit a structured heal record for the dashboard activity stream.
> Enforce the Shadow invariant: no promotion without `verdict:'promote'`.
> **VERIFY:** end-to-end on ShopLite the SQLi heals: detected → confirmed → patched in Shadow → re-attack closed → proof recorded → promoted → antibody minted. Paste the final `vulnerability` doc and the `shadow_proof`.

### T2.5 · Immune System n8n reflex — `orchestration/n8n` · [P0] · depends: T2.4

> **PROMPT**
> Goal: make the §4 loop autonomous + scheduled, "a workflow you can watch fire".
> Files you may touch: `orchestration/n8n/workflows/immune.json`, n8n README.
> Requirements: an importable n8n workflow that, on schedule and on a manual "Run Immune Scan" trigger, calls `scan.run` → for each confirmed finding calls `vuln.heal` → emits heal records, entirely via `/api/reflex/*`. No human steps between scan and heal.
> **VERIFY:** import the workflow; fire the manual trigger; paste the n8n execution log showing scan → heal → antibody with zero manual steps.

### T3.1 · Antibody minting — `packages/engine` · [P0] · depends: T0.3,T0.4

> **PROMPT**
> Goal: §5 "mint on every cure" — a permanent regression test + runtime assertion.
> Files you may touch: `packages/engine/src/memory/mint.ts` + tests + engine index.
> Requirements: `mintAntibody(source: {type:'vuln'|'incident', ref}): Promise<Antibody>` uses `sarvam.chat` (strict-JSON) to synthesize a `regressionTest` (fails on vulnerable behaviour, passes after fix) and a `runtimeAssertion`; compute a stable `signature` and `embedding` via `embed()`; persist to the `antibody` collection (fields exactly per §B.2), link `antibodyId` back to the source, and place the regression test into the target app's test suite. Increment a global antibody count.
> **VERIFY:** healing a ShopLite vuln mints an antibody; paste the antibody doc; run the generated regression test and show it FAILS on the old code and PASSES on the fixed code.

### T3.2 · Vector recall + recurrence blocking — `packages/engine` · [P1] · depends: T3.1

> **PROMPT**
> Goal: §5 "embed for recall / match new threats / block recurrence".
> Files you may touch: `packages/engine/src/memory/recall.ts` + tests + engine index.
> Requirements: `matchAntibody(signatureOrEmbedding)` uses Atlas Vector Search over `antibody.embedding` (confirm `$vectorSearch` aggregation syntax from current docs) to find near-matches and short-circuit to the known cure. `blockRecurrence()` runs all antibody regression tests + assertions at CI/deploy and FAILS the build on reappearance, incrementing `recurrencesBlocked`. CLI `pnpm --filter engine antibodies:check`.
> **VERIFY:** re-running the exact healed attack is blocked by its antibody (paste the block); a similar-but-not-identical threat is matched via vector search (paste the match score).


## PHASE 4 — The Shadow (§8) — the safety organ every other organ depends on

> §8 is the precondition for all autonomy. Flow: mirror real behaviour → apply change in isolation → verify behaviour-equivalence (Sarvam) → promote only on stored proof. Data model: `shadow_proof` (verbatim §B.2).

### T4.1 · Shadow twin runtime — `shadow/` + `packages/engine` · [P0] · depends: T1.1

> **PROMPT**
> Goal: an isolated clone of the target where every candidate change is applied first.
> Files you may touch: `shadow/**`, `packages/engine/src/shadow/runtime.ts` + tests + engine index.
> Requirements:
> 1. `shadow/docker-compose.yml`: run a clone of the target app on port 3002 with its own throwaway DB seeded from the target. Full isolation — no write may reach the real target (:3001) or its DB.
> 2. Engine helpers: `spinShadow(commit?)`, `applyToShadow(patch)`, `replayTraffic(samples)` where `samples` = a small captured/synthetic request set PLUS the exact failing request for an incident.
> Do NOT let any Shadow operation touch the real target.
> **VERIFY:** shadow boots independently on :3002; replay a sample set and paste results; prove (e.g. with a write attempt) that no Shadow action affects :3001 or its data.

### T4.2 · Behaviour-equivalence verification + proofs — `packages/engine` · [P0] · depends: T4.1,T0.4

> **PROMPT**
> Goal: §8 "verify behaviour-equivalence; promote only on proof". This is the global promotion gate.
> Files you may touch: `packages/engine/src/shadow/verify.ts` + tests + engine index.
> Requirements: `verifyEquivalence(changeRef, cases): Promise<ShadowProof>` replays `cases` against shadow-before and shadow-after, then uses `sarvam.chat` to judge whether anything changed BEYOND the intended fix (the failing case must now pass; nothing else may regress). Produce a `shadow_proof` doc exactly per §B.2 (`replayedCases`, `intendedFixPassed`, `regressions`, `verdict`). Export a single `assertPromotable(changeRef)` that throws `VerificationError` unless `verdict:'promote'`, and require EVERY organ (Immune, Resurrection, Metabolism) to call it before promoting.
> **VERIFY:** a correct security patch yields `verdict:'promote'`; a deliberately behaviour-changing patch yields `verdict:'reject'` and blocks promotion. Paste both proof docs.

## PHASE 5 — Nervous System & Resurrection Reflex (§7) — "Build core path"

> §7 flow is fixed: **detection (learned baseline) → containment (auto-rollback) → diagnosis (Gemini parse + Sarvam reason) → cure (Shadow) → immunise (antibody) → report (Bulbul/Saaras).** Data model: `incident` (verbatim §B.2). Demo: breaking deploy self-heals; "resolved: 71 seconds" voice.

### T5.1 · Telemetry + baseline + divergence detection — `packages/engine` · [P0] · depends: T0.3

> **PROMPT**
> Goal: §7 "detection" — feel a bad deploy within seconds via learned baselines, including "up but wrong" failures (200s with corrupted output), not just crashes.
> Files you may touch: `packages/engine/src/nervous/sense.ts` + tests + engine index.
> Requirements: a lightweight telemetry collector for the target (request rate, error rate, latency per route, key business signals) writing rolling stats to Mongo; `learnBaseline()` (per-signal normal + variance); `detectDivergence()` returning a `baselineDelta` + severity + blast-radius, catching behavioural (not just crash) divergence; on divergence, capture the EXACT triggering request + state as evidence. Expose the `incident.handle` reflex entry.
> **VERIFY:** inject a behavioural fault on ShopLite; show detection within seconds and paste the captured triggering request + computed `baselineDelta`.

### T5.2 · Deploy correlation + auto-rollback — `packages/engine` · [P0] · depends: T5.1

> **PROMPT**
> Goal: §7 "containment — auto-roll-back to the last genetically-healthy build; users restored first".
> Files you may touch: `packages/engine/src/nervous/rollback.ts` + tests + engine index.
> Requirements: a `deploy` webhook records each deploy `{deployId, commit, ts}`; `autoRollback(incident)` correlates the divergence to the preceding deploy and rolls the target back to the last healthy build (demo: last green commit). Record `rollbackAt`. Make rollback the DEFAULT FIRST ACTION before diagnosis.
> **VERIFY:** a bad deploy is auto-rolled-back within seconds of divergence; paste timeline showing rollback precedes diagnosis; confirm the previous good version is restored.

### T5.3 · Causal chain reconstruction — `packages/engine` · [P0] · depends: T5.1,T0.4

> **PROMPT**
> Goal: §7 "diagnosis — Gemini parses logs; Sarvam reconstructs the causal chain from captured evidence". No guessing.
> Files you may touch: `packages/engine/src/nervous/diagnose.ts` + tests + engine index.
> Requirements: `reconstructCausalChain(incident): Promise<CausalStep[]>` — feed captured logs/traces to `gemini.analyze` for parsing, then `sarvam.chat` (strict-JSON) to produce an ordered chain `deploy → triggering request → fault → failing line`, every step carrying an `evidenceRef` to captured evidence (reject any step not grounded in evidence). Store `causalChain` on the incident; produce a one-line human summary.
> **VERIFY:** for the injected fault the chain correctly names the guilty deploy and failing line; paste the chain with evidenceRefs.

### T5.4 · Reproduce → fix → verify → promote → immunise — `packages/engine` · [P0] · depends: T5.3,T4.2,T3.1

> **PROMPT**
> Goal: §7 "cure + immunise" — the full autonomous heal.
> Files you may touch: `packages/engine/src/nervous/heal.ts` + tests + engine index; wire `incident.handle`.
> Requirements: `healIncident(incident)` — reproduce the failure in the Shadow using the exact failing request → `sarvam.chat` synthesizes a fix → `verifyEquivalence` (failing case passes, zero regressions) → `assertPromotable` → promote → `mintAntibody` so it can't recur. Fill `fixRef`, `shadowProof`, `antibodyId`, `userImpactSeconds`. If verification fails, keep the rollback and escalate to a human flag — never promote unverified.
> **VERIFY:** end-to-end an injected incident is contained, diagnosed, healed in Shadow, promoted, immunised; paste the full `incident` doc with all fields populated.

### T5.5 · Morning report + voice briefing (Bulbul/Saaras) — `apps/web` · [P1] · depends: T5.4,T0.4

> **PROMPT**
> Goal: §7 "report" — one-line report + spoken briefing + spoken follow-up.
> Files you may touch: `apps/web/app/(dashboard)/incidents/**`, `apps/web/app/api/voice/**`.
> Requirements: generate a one-line report per resolved incident (deploy, impact %, root cause, rollback time, fix time, antibodyId, userImpactSeconds). Synthesize it with `sarvam.tts` (Bulbul, user's language) and play in the dashboard; add a mic input → `sarvam.stt` (Saaras) → answer from the incident record → speak the answer. Text fallback if voice fails.
> **VERIFY:** after a healed incident, the dashboard speaks a correct summary; ask one spoken follow-up and paste the transcript + answer.

### T5.6 · Resurrection Reflex n8n workflow — `orchestration/n8n` · [P0] · depends: T5.4

> **PROMPT**
> Goal: §7 "orchestrates the full reflex arc as a workflow you can watch fire".
> Files you may touch: `orchestration/n8n/workflows/resurrection.json`, n8n README.
> Requirements: importable workflow: trigger on `deploy` webhook + divergence → `autoRollback` → `reconstructCausalChain` → `healIncident` → emit report + voice. Every node calls `/api/reflex/*`. Add a demo trigger that pushes a known-breaking deploy.
> **VERIFY:** fire the demo trigger; paste the n8n execution showing detect → rollback → diagnose → heal → antibody → report with zero human steps.

## PHASE 6 — Genome (§3) — "Build detection"

> §3 flow: capture intent strand → base-pair continuously (Gemini) → flag mismatches both directions → Sarvam proposes minimal correction (routed to Shadow). Data model: `intent_strand` (verbatim §B.2). Demo: a silent fix that drops a compliance approval step lights up as invariant #N unpaired.

### T6.1 · Intent strand capture — `packages/engine` · [P1] · depends: T0.3,T0.4

> **PROMPT**
> Goal: §3 "capture the intent strand" per module.
> Files you may touch: `packages/engine/src/genome/capture.ts` + tests + engine index.
> Requirements: `captureIntent(modulePath): Promise<IntentStrand>` — ingest PR description, linked issues, and the generating prompt/spec; use `sarvam.chat` (strict-JSON) to extract `purpose`, `invariants` (with `rationale` and `compliance` flag), `edgeDecisions`; persist to `intent_strand` (fields exactly per §B.2). CLI `pnpm --filter engine intent:capture --module=<path>`. Seed ShopLite modules, including a compliance invariant "refunds over a threshold require approval".
> **VERIFY:** each seeded module has a stored `intent_strand` with ≥1 `compliance:true` invariant; paste the checkout module's strand.

### T6.2 · Base-pairing + drift detection — `packages/engine` · [P1] · depends: T6.1

> **PROMPT**
> Goal: §3 "base-pair continuously + flag mutations both directions + propose minimal correction".
> Files you may touch: `packages/engine/src/genome/pair.ts` + tests + engine index; wire `genome.pair`.
> Requirements: `pairGenome(moduleId)` — `gemini.analyze` reads code + intent together, computes `pairing.score` and `unpairedInvariants`; flags code-drifted-from-intent AND intent-changed-leaving-code-unpaired; for each mismatch `sarvam.chat` explains the divergence and proposes a minimal correction routed through `verifyEquivalence` before any promotion. Persist updated `pairing`.
> Demo case: simulate a fix that silently drops the refund-approval step; show the Genome flags that specific unpaired invariant with the offending diff.
> **VERIFY:** apply the silent rule-drop; paste the flagged unpaired invariant id + the diff; confirm correction proposals are gated by Shadow.

## PHASE 7 — Metabolism (§6) — "Temperature gauge"

> §6: measure temperature (Gemini, 5 dims) → project rewrite weeks → (P2) repair enzymes as Shadow-verified PRs. Data model: `entropy_timeseries` (time-series, verbatim §B.2). Demo: temperature climbs under a burst, bends down when metabolism runs.

### T7.1 · Entropy temperature + trajectory — `packages/engine` · [P1] · depends: T0.3,T0.4

> **PROMPT**
> Goal: §6 "measure temperature + project the cliff".
> Files you may touch: `packages/engine/src/metabolism/temperature.ts` + tests + engine index; wire `entropy.measure`.
> Requirements: `measureEntropy(repoPath): Promise<EntropyPoint>` — `gemini.analyze` over the repo computes the five dims EXACTLY: `duplication, patternVariance, coupling, vulnDensity, comprehension`; reduce to one `temperature` scalar; project `projectedRewriteWeeks` from the trajectory. Persist to the `entropy_timeseries` time-series collection (fields per §B.2). CLI `pnpm --filter engine entropy:measure`.
> **VERIFY:** run on a repo; paste the `EntropyPoint`; add duplicated code and show `temperature` rises and `projectedRewriteWeeks` falls.

### T7.2 · Repair enzyme (consolidator) — `packages/engine` · [P2] · depends: T7.1,T4.2

> **PROMPT**
> Goal: §6 "repair enzymes as Shadow-verified PRs" (consolidator only for v1).
> Files you may touch: `packages/engine/src/metabolism/consolidator.ts` + tests + engine index.
> Requirements: find duplicated implementations; `sarvam.chat` collapses them into one; ship as a PR that MUST pass `verifyEquivalence`. Schedule via n8n. Show temperature bending down after a run.
> **VERIFY:** a known duplication is collapsed via a verified PR; paste before/after temperature.

## PHASE 8 — Governor (§9) + Vital Signs (§10)

### T8.1 · Governor (homeostasis) — `packages/engine` · [P2] · depends: T7.1,T2.4

> **PROMPT**
> Goal: §9 "track two rates + enforce entropy budget + report one number".
> Files you may touch: `packages/engine/src/governor/homeostasis.ts` + tests + engine index.
> Requirements: track `generationRate` (incoming change) vs `repairRate` (drift fixed + vulns healed + entropy digested) over a rolling `window`; compute `balance` and choose `action` (`ok|reprioritise|gate`); when generation outpaces repair, reprioritise organ work onto `hottestZones` and surface "building Nx faster than this system can stay alive". Persist to `homeostasis` (fields per §B.2).
> **VERIFY:** under a simulated generation burst the Governor reports imbalance + a safe-build-rate verdict; paste the `homeostasis` doc.

### T8.2 · Vital Signs dashboard — `apps/web` · [P0] · depends: T2.4,T3.1,T5.4

> **PROMPT**
> Goal: §10 "the single pane — software health as a living thing", read straight from MongoDB.
> Files you may touch: `apps/web/app/(dashboard)/**`, `apps/web/app/api/stream/**` (SSE), dashboard components.
> Requirements: build the dashboard (shadcn/ui + Tailwind) showing the five §10 vitals: **Temperature** (entropy scalar + trajectory), **Genetic integrity** (intent–code pairing %), **Immune status** (open vulns + ever-rising antibody count), **Heart rate** (deploy/incident velocity), **Lifeline** (projected health curve: green thriving, or red "rewrite in N weeks"). Add a live **activity stream** via SSE showing reflex arcs firing in real time ("scanning… SQLi found… patching in shadow… re-attack: closed… antibody #N minted"; "divergence detected… rolled back… healed… resolved 71s"). Read all data via `@helix/db`. Wire the voice briefing button (T5.5). Legible in five seconds to a non-engineer.
> Do NOT compute organ logic in the UI — read persisted state only.
> **VERIFY:** run an immune heal and an incident heal; paste/screenshot the dashboard updating live with correct vitals and the activity stream entries.

## PHASE 9 — Integration, demo, hardening

### T9.1 · Setup + demo orchestration — `scripts/` · [P0] · depends: all P0

> **PROMPT**
> Goal: one-command setup + three repeatable, idempotent demo scenarios matching the deep-dive demo moments.
> Files you may touch: `scripts/**`, root `package.json` scripts.
> Requirements:
> - `setup.ts`: bring up MongoDB + n8n + target + shadow, seed, create the vector index, import both n8n workflows.
> - `demo:security.ts`: reset ShopLite to vulnerable → run the Immune workflow → judges watch the live SQLi self-heal + antibody mint → then prove recurrence is blocked (§4/§5 demo).
> - `demo:incident.ts`: deploy a known-breaking change → watch the Resurrection Reflex contain → diagnose → heal → voice-brief "resolved: 71s" (§7 demo).
> - `demo:drift.ts`: apply the silent refund-approval drop → Genome flags the unpaired invariant (§3 demo).
> Each demo must be idempotent and resettable.
> **VERIFY:** run `pnpm demo:security` and `pnpm demo:incident` start-to-finish; paste the run logs; confirm clean reset afterward.

### T9.2 · Hardening, fallbacks, README, one-command demo — repo-wide · [P0] · depends: T9.1

> **PROMPT**
> Goal: make it robust for the stage and fully documented.
> Files you may touch: error-handling/fallbacks within existing organ files; root `README.md`; `Makefile`/root scripts.
> Requirements: add graceful fallbacks — text fallback if voice fails; sovereign fallback if Sarvam credits run out (`HELIX_SOVEREIGN=1`); exact-match fallback if vector search is unavailable. Write a thorough `README.md`: a Mermaid architecture diagram, the organ map (§3–§10), setup steps, env vars, how each sponsor tool is used (Gemini=Perception, Sarvam=Cognition+voice, MongoDB=memory, n8n=wiring), and a "Run the demo" section. Add `make demo`. Ensure `pnpm -w typecheck && pnpm -w build && pnpm -w lint` pass clean repo-wide.
> Do NOT introduce new features here — hardening + docs only.
> **VERIFY:** paste clean output of `pnpm -w typecheck`, `pnpm -w build`, `pnpm -w lint`; from a fresh clone, follow the README to a working demo and confirm.

---

# §E. Build order (36-hour cut, mirrors deep-dive §12 priority)

| Window | Tasks | Outcome |
|---|---|---|
| 0–3h | T0.0–T0.5 | Contract, monorepo, shared types, DB, AI clients, n8n + reflex stubs. |
| 3–5h | T1.1 | ShopLite patient with the four planted vulns. |
| 5–9h | T4.1, T4.2 | Shadow twin + equivalence proof gate (needed before any heal). |
| 9–16h | T2.1, T2.2, T2.3, T2.4, T3.1, T2.5 | **Immune System + Memory fully** — live SQLi self-heal + antibody. |
| 16–24h | T5.1–T5.4, T5.6 | **Resurrection Reflex core path** — breaking deploy self-heals. |
| 24–28h | T8.2, T3.2 | Vital Signs dashboard (live) + recurrence blocking. |
| 28–32h | T5.5, T6.1, T6.2 | Voice briefing + Genome drift flag. |
| 32–36h | T9.1, T9.2 | Demo scripts, fallbacks, README, rehearsal. |

P1/P2 (Metabolism enzyme T7.2, Governor T8.1, sovereign polish) only if time remains — shown in Vital Signs as the vision per §12.

# §F. Final acceptance — "HELIX is completely built" when:

1. **Immune (§4) + Memory (§5):** attach ShopLite URL → real SQLi found → patched in Shadow → re-attack confirms closed → promoted with `shadow_proof` → antibody minted → re-running the attack is blocked. ✅
2. **Resurrection (§7):** a breaking deploy is auto-rolled-back in seconds → causal chain reconstructed from evidence → healed in Shadow → promoted → antibody minted → spoken "resolved: Ns" briefing. ✅
3. **Genome (§3):** a silent compliance rule-drop is flagged as a specific unpaired invariant with the diff. ✅
4. **Metabolism (§6):** temperature rises under a duplication burst and the rewrite projection shortens. ✅
5. **Shadow (§8):** no promotion anywhere ever occurs without a stored `verdict:'promote'` proof. ✅
6. **Vital Signs (§10):** one screen shows all five vitals updating live, with the activity stream, and can speak its status. ✅
7. **Gates:** `pnpm -w typecheck && build && lint` clean; every organ's MongoDB docs match §B.2 field-for-field; only permitted files were touched per task. ✅

> If all seven hold, HELIX is built exactly as the Technical Deep-Dive specifies — no drift between document and system.

**HELIX — AI made software grow at machine speed. We made it stay alive at machine speed.**
