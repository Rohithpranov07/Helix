# n8n Orchestration

## Workflow-as-code sync (Public API) — preferred

The JSON files in `workflows/` are the source of truth. `scripts/n8n-sync.mjs`
pushes them to an n8n instance over the [Public API](https://docs.n8n.io/api/)
(`X-N8N-API-KEY` header, `/api/v1` base) so you never hand-import again.

**Configure** (`.env`):
```
N8N_API_URL=https://<you>.app.n8n.cloud   # or http://localhost:5678 for self-hosted
N8N_API_KEY=<key for THAT instance>        # Settings → n8n API. Cloud keys != self-hosted keys.
```

**Commands** (run from repo root):
```bash
pnpm n8n:ping    # verify URL + key (read-only)
pnpm n8n:list    # list workflows on the instance
pnpm n8n:push    # upsert all workflows, leave INACTIVE
pnpm n8n:sync    # upsert all workflows AND activate
```

The script upserts by workflow **name** (PUT if present, POST if new) — idempotent,
safe to re-run. It strips read-only keys (`id`, `active`, `tags`, `pinData`,
`versionId`, `meta`) that the API rejects with a 400.

**⚠ Cloud reachability:** workflows call the control plane at
`http://host.docker.internal:3000`, which only resolves for **self-hosted Docker
n8n on the same host**. A **cloud** instance cannot reach your laptop — expose
`localhost:3000` via a tunnel (ngrok/cloudflared), set `HELIX_PUBLIC_API_BASE` to
the tunnel URL (the sync rewrites the control-plane host to it), then `pnpm n8n:sync`
to activate. Until then, use `pnpm n8n:push` (inactive) so a scheduled cron
doesn't fire-and-fail.

---

## Resurrection Reflex workflow (T5.6) — full autonomous arc

`orchestration/n8n/workflows/resurrection.json` — the complete demo workflow that
shows the full Resurrection Reflex arc firing with zero human steps.

**Arc:** `deploy webhook → detect → diagnose → auto-heal (Shadow) → close vulns → report`

### Nodes (watchable in n8n UI)
| Node | Reflex | What it does |
|---|---|---|
| Webhook: Deploy Signal | `POST /helix-resurrect` | Receives the deploy divergence signal |
| Manual: Demo Breaking Deploy | — | One-click demo trigger |
| Code: Demo Payload | — | Injects pre-configured SQLi breaking deploy |
| HTTP: incident.handle | `/api/reflex/incident-handle` | Detect + diagnose + auto-heal (T5.1+T5.4) |
| IF: Rollback Detected | — | Gates on `incident.rollbackAt` |
| HTTP: incident.resolve | `/api/reflex/incident-resolve` | Close remaining open vulns (T5.3) |
| HTTP: voice.report | `/api/reflex/voice-report` | Voice briefing stub (T5.5, continueOnFail) |
| Respond: Resurrection Report | — | Returns full JSON report with `zeroHumanSteps: true` |
| Respond: System Stable | — | Stable path — no healing required |

### Fire the demo trigger (cloud)
```bash
curl -X POST https://rohithpranov.app.n8n.cloud/webhook/helix-resurrect \
  -H "Content-Type: application/json" \
  -d '{
    "deployId": "demo-deploy-sqli-001",
    "signal": {
      "url": "http://host.docker.internal:3001/api/products/search",
      "status": 500,
      "latencyMs": 8500,
      "error": "unterminated string literal in SQL query"
    }
  }'
```

Or click **Manual: Demo Breaking Deploy** → **Execute Node** inside n8n.

### Live execution proof (2026-06-13, execution #21)
```
execution 21 | status: success | duration: ~24s
  ✓ Webhook: Deploy Signal       → received deployId:demo-deploy-sqli-001
  ✓ HTTP: incident.handle        → incidentId:inc-1781363032498-rc7ddy | causalSteps:4 | rollbackAt:set
  ✓ IF: Rollback Detected        → true branch — rollback recommended
  ✓ HTTP: incident.resolve       → 2 vulns found, skipped (Shadow not running)
  ✓ HTTP: voice.report           → 500 (T5.5 not yet built, continueOnFail kept arc running)
  ✓ Respond: Resurrection Report → {"status":"escalated","causalSteps":4,"zeroHumanSteps":true}
```
`status:escalated` is correct — without a running Shadow container, HELIX refuses to
promote unverified patches (Shadow invariant). With Shadow running, status is `immunised`.

### Add to sync
Syncing via `pnpm n8n:sync` deploys and activates all three workflows:
- `immune.json` — Immune System (scan + heal every 15 min)
- `nervous.json` — Nervous System (deploy signal → incident handle → resolve)
- `resurrection.json` — Resurrection Reflex (full demo arc, this workflow)

---

## Immune System workflow — import & fire (manual alternative)

The workflow is pre-built at `orchestration/n8n/workflows/immune.json`.

**Import steps:**
1. Start n8n: `docker compose up -d` (from repo root)
2. Open http://localhost:5678 and create an owner account
3. Go to **Workflows → Import from File** and select `orchestration/n8n/workflows/immune.json`
4. Click **Save**, then **Activate** (toggle at top-right) to enable the 15-minute schedule

**Fire the manual trigger (demo):**
1. Open the imported workflow
2. Click the **Manual: Run Immune Scan** node → **Execute Node**
   — or click the top-right **Execute Workflow** button
3. Watch the execution log: `scan.run → Split Out: findings → vuln.heal` per finding
4. Each `vuln.heal` response contains `{ vulnerability: { status, ... }, proof? }`

**Execution log shows (zero manual steps):**
```
Manual: Run Immune Scan → HTTP: scan.run (findings: [...])
  → Split Out: findings (N items)
  → HTTP: vuln.heal × N (status: healed | patching)
```

**Linux note:** `host.docker.internal` is only auto-available on macOS/Windows Docker Desktop.
On Linux, add this to `orchestration/n8n/docker-compose.yml` under the `n8n` service:
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

---


n8n is HELIX's autonomic nervous system — it fires reflex arcs (scheduled loops and event-driven triggers) that call the HELIX control plane.

## Start

```bash
# From repo root — starts n8n + optional local MongoDB
docker compose up -d

# Or just n8n standalone
docker compose -f orchestration/n8n/docker-compose.yml up -d
```

n8n UI: **http://localhost:5678**

On first launch, create an owner account in the UI. Store those credentials securely; they are not in env.

## How n8n calls HELIX reflex endpoints

Each n8n workflow uses an **HTTP Request** node targeting:

```
POST ${HELIX_API_BASE}/api/reflex/<action>
```

| Reflex | Endpoint | Trigger |
|---|---|---|
| `scan.run` | `/api/reflex/scan` | Cron every 15 min |
| `vuln.heal` | `/api/reflex/vuln-heal` | Webhook on open vulnerability |
| `incident.handle` | `/api/reflex/incident-handle` | Webhook on deploy signal |
| `genome.pair` | `/api/reflex/genome-pair` | Cron every hour |
| `entropy.measure` | `/api/reflex/entropy-measure` | Cron every 6 hours |

`HELIX_API_BASE` defaults to `http://localhost:3000`. In production, set it to the deployed control plane URL.

## Payload shapes

All payloads are defined as Zod schemas in `packages/shared/src/contracts.ts`. n8n workflows must send JSON bodies matching those schemas exactly.

### scan.run
```json
{ "targetUrl": "http://localhost:3001" }
```

### vuln.heal
```json
{ "findingId": "<vulnerability _id>" }
```

### incident.handle
```json
{ "deployId": "<deploy id>", "signal": { ...any... } }
```

### genome.pair
```json
{ "moduleId": "<module id>" }
```

### entropy.measure
```json
{ "repoPath": "/app" }
```

## Required environment variable

`N8N_ENCRYPTION_KEY` — random 32-char string used to encrypt stored credentials. Set in `.env` before first run. Losing this key means losing access to all stored credentials.

Generate one:
```bash
openssl rand -hex 16
```
