# n8n Orchestration

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
