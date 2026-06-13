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
  - Sarvam  = PRIMARY LLM — all reasoning, patch synthesis, drift judgement,
              causal reconstruction, behaviour-equivalence judgement, test/assertion
              generation, Bulbul TTS, Saaras STT. Used across nearly every organ.
              Default and dominant AI provider.
  - Gemini  = LOW SURFACE AREA ONLY — used only for whole-repo wide-context reads
              where Sarvam cannot substitute: entropy field computation, intent-code
              base-pairing across many files simultaneously, log/UI parsing for
              Resurrection Reflex. Never route reasoning, patches, or judgement to Gemini.
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

---

## Project Map

### Repo structure (§B.5)
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

### MongoDB collections (§B.4 — exact names)
- `intent_strand`
- `vulnerability`
- `antibody` (vector index on `embedding`)
- `entropy_timeseries` (time-series collection)
- `incident`
- `shadow_proof`
- `homeostasis`
