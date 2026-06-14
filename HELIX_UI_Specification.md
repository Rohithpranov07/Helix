# HELIX — Complete UI Specification
### Every page, every section, every data field — built from the PRD & Build Instructions

---

## Overview: The App Shell

**Tech stack:** Next.js 15 App Router · shadcn/ui · Tailwind v4  
**Port:** 3000  
**Aesthetic:** Dark-mode organism — think living system, not SaaS dashboard. Deep blacks, biomorphic greens (#22c55e family), pulsing ambers and reds for danger states. The UI literally feels alive.

---

## PAGE MAP

```
/                           → Landing / Attach Page (entry point)
/dashboard                  → Vital Signs Dashboard (main view)
/dashboard/immune           → Immune System — Vulnerabilities
/dashboard/incidents        → Incidents — Resurrection Reflex
/dashboard/genome           → Genome — Drift & Intent
/dashboard/metabolism       → Metabolism — Entropy
/dashboard/shadow           → Shadow Proofs
/dashboard/antibodies       → Antibody Library
/settings                   → Settings — Targets, API keys, env
```

---

## PAGE 1 — LANDING / ATTACH PAGE (`/`)

**Purpose:** Zero-to-value in under 5 minutes. A solo founder lands here and attaches their app URL.

### Hero Section
- **Full-viewport** dark hero, centered
- Headline: `"AI built your software. HELIX keeps it alive."`
- Sub-headline: `"Attach a URL. Find real vulnerabilities. Watch them heal. In minutes."`
- **Big input field** — `Enter your app URL (e.g. https://myapp.com)` with a `→ Attach & Scan` CTA button in green
- Under the input: small text — `"Scans only targets you authorize. First scan starts in seconds."`

### Three Proof Points (below hero, horizontal cards)
- 🔴 **Security** — "SQLi, XSS, RLS holes found and healed — not just flagged"
- 🟢 **Incidents** — "Crash at midnight? Rolled back, diagnosed, and fixed before you wake"
- 🧬 **Memory** — "Every cure mints a permanent antibody. It can never happen again."

### Live Demo Ticker
- A scrolling marquee at the bottom of the hero showing synthetic activity:
  `→ SQLi detected at /api/search … patching in Shadow … re-attack: closed … antibody #47 minted`

### No login wall on page 1 for hackathon demo.

---

## PAGE 2 — VITAL SIGNS DASHBOARD (`/dashboard`)

**This is the centrepiece — "the single pane, legible in 5 seconds to a non-engineer."**  
Every widget reads from persisted MongoDB state via SSE. No organ logic in the UI.

---

### 2.1 TOP BAR (persistent across all dashboard pages)

| Element | Detail |
|---|---|
| **HELIX logo** | Left — stylised double-helix icon in green |
| **Target badge** | `● LIVE  shopLite.localhost:3001` — pulsing green dot |
| **Last scan** | `Last scan: 2 min ago` |
| **Organism status** | Pill badge — `STABLE` (green) / `HEALING` (amber pulsing) / `CRITICAL` (red) |
| **Voice briefing button** | 🔊 `Speak Status` — triggers Sarvam Bulbul TTS |
| **Run Immune Scan** | Manual trigger button — calls `scan.run` reflex |
| **Nav links** | Immune · Incidents · Genome · Metabolism · Shadow · Antibodies |

---

### 2.2 VITAL SIGNS STRIP (top of dashboard, 5 cards in a row)

Each card shows: icon · label · primary value · trend arrow · sub-label.

#### Card 1 — 🌡️ Temperature
- **Primary value:** `62°` (entropy scalar 0–100)
- **Trend:** `↑ +4 in 1h` (red if rising, green if falling)
- **Sub:** `Rewrite cliff in ~14 weeks`
- **Visual:** A thin horizontal bar, gradient green→amber→red, with a needle at current temp
- Data source: `entropy_timeseries.temperature` + `projectedRewriteWeeks`

#### Card 2 — 🧬 Genetic Integrity
- **Primary value:** `84%` (intent–code pairing %)
- **Trend:** `↓ 2 unpaired invariants`
- **Sub:** `5 modules paired · 2 drifted`
- **Visual:** Circular progress ring, green fill
- Data source: `intent_strand.pairing.score` averaged across modules

#### Card 3 — 🛡️ Immune Status
- **Primary value:** `2 open` (vulnerabilities)
- **Trend:** `↑ 47 antibodies` (ever-rising)
- **Sub:** `1 healing · 0 unconfirmed`
- **Visual:** Shield icon, amber if open > 0, green if 0
- Data source: `vulnerability` collection counts + `antibody` count

#### Card 4 — 💓 Heart Rate
- **Primary value:** `4 deploys / 24h`
- **Trend:** `1 incident this week`
- **Sub:** `MTTR: 71s avg`
- **Visual:** Mini sparkline (last 7 days deploy bars)
- Data source: `incident` collection + deploy timestamps

#### Card 5 — 📈 Lifeline
- **Primary value:** `THRIVING` or `REWRITE IN 14W`
- **Visual:** A mini line chart — green curve trending up = thriving, red curve bending down = danger
- **Sub:** `At current rate: healthy` or `At current rate: cliff in N weeks`
- Data source: `entropy_timeseries` trajectory

---

### 2.3 MAIN CONTENT AREA (two columns)

#### LEFT COLUMN (60%) — Activity Stream

**Header:** `⚡ Live Activity` + a green pulsing dot

This is an SSE-fed real-time log of every reflex arc firing. Entries scroll in from the top.

Each entry format:
```
[timestamp]  [organ icon]  [event description]  [status pill]
```

**Example entries (in order, newest first):**
```
14:32:01  🛡️  SQLi detected at /api/search?q=        [DETECTED]
14:32:04  🛡️  Reproducing exploit — differential test  [CONFIRMING]
14:32:07  🛡️  Confirmed exploitable — patching in Shadow [PATCHING]
14:32:18  🛡️  Re-attack on Shadow: /api/search?q='OR'1  [CLOSED ✓]
14:32:19  🛡️  Shadow proof recorded — promoting patch   [PROMOTING]
14:32:20  🧬  Antibody #48 minted                       [IMMUNISED]
14:31:55  💓  Deploy #12 detected — baselining...        [WATCHING]
14:28:00  💓  Divergence: error rate +340% from baseline  [INCIDENT]
14:28:01  💓  Auto-rollback to commit a3f9b → users restored [CONTAINED]
14:28:08  💓  Causal chain: deploy→null ref→checkout crash  [DIAGNOSED]
14:28:44  💓  Fix verified in Shadow (71s total)           [HEALED]
14:28:45  🧬  Antibody #47 minted                          [IMMUNISED]
```

Each entry is expandable → clicking reveals the full evidence panel (diff, proof ID, causal chain).

**Filter tabs** above the stream: `All · Security · Incidents · Genome · Metabolism`

---

#### RIGHT COLUMN (40%) — Organ Status Cards

**Card A — Immune System**
- Status: `2 open · 1 healing · 44 healed`
- Mini table: last 3 findings with class badge (SQLi / XSS / RLS) and status pill
- `→ View all` link to `/dashboard/immune`

**Card B — Resurrection Reflex**
- Status: `Last incident: 2h ago · Resolved in 71s`
- Mini timeline: Detected → Rolled back (3s) → Diagnosed → Healed (71s)
- `→ View all` link to `/dashboard/incidents`

**Card C — Genome**
- Status: `84% paired · 2 invariants unmatched`
- List of drifted modules: `checkout.ts — refund-approval invariant unpaired`
- `→ View all` link to `/dashboard/genome`

**Card D — Shadow**
- Status: `12 proofs stored · 0 rejected this week`
- Last proof: `a3f9b — promote ✓`
- `→ View all` link to `/dashboard/shadow`

---

### 2.4 BOTTOM — Antibody Count Banner

A full-width green banner (subtle, not loud):
```
🧬  HELIX has minted 48 antibodies.  This codebase is permanently stronger than it was yesterday.
```

---

## PAGE 3 — IMMUNE SYSTEM (`/dashboard/immune`)

**Purpose:** Full visibility into all vulnerabilities — open, healing, healed.

### 3.1 Header Stats Row
| Stat | Value |
|---|---|
| Open | `2` (red badge) |
| Patching | `1` (amber badge) |
| Healed | `44` (green badge) |
| Antibodies minted | `47` |

### 3.2 Vulnerability Table

Columns: `Class · Endpoint · Status · Detected · Healed · Antibody · Evidence`

- **Class column:** colour-coded pill — `SQLi` (red), `XSS` (orange), `missingRLS` (yellow), `secretLeak` (purple), `authBypass` (pink)
- **Status column:** `open` (red pulsing dot) · `patching` (amber spinner) · `healed` (green check)
- **Evidence column:** `👁 View` button → opens a drawer

### 3.3 Vulnerability Detail Drawer (right-side slide-in)

When a row is clicked, a drawer slides in showing:

**Top:** Class badge + endpoint + status

**Tabs inside drawer:**
1. **Evidence** — the raw exploit proof (e.g. `SQL error: syntax near 'OR'`)
2. **Patch Diff** — the code diff applied in Shadow (file path, before/after lines)
3. **Re-attack Proof** — `Before: open · After: closed` — the exact HTTP request/response pairs
4. **Shadow Proof** — `proofId: sha-xxx · replayedCases: 12 · regressions: 0 · verdict: promote`
5. **Antibody** — `antibodyId · regressionTest code · runtimeAssertion · recurrencesBlocked: 0`

### 3.4 Scan Controls

- **Target URL field** (editable) + `▶ Run Scan Now` button
- **Schedule display:** `Next auto-scan: in 18 min`
- **Scan log:** collapsible last-scan output

---

## PAGE 4 — INCIDENTS / RESURRECTION REFLEX (`/dashboard/incidents`)

**Purpose:** Every production incident — its timeline, causal chain, fix, and voice report.

### 4.1 Header Stats Row
| Stat | Value |
|---|---|
| Total incidents | `3` |
| Avg MTTR | `71s` |
| Currently active | `0` (or `1 ACTIVE` in red if live) |
| Rollbacks | `3` |

### 4.2 Incident List

Each incident card shows:
- **Deploy ID + commit hash** (`Deploy #12 · a3f9b3c`)
- **Detected at** timestamp
- **Status pill:** `ACTIVE` (red pulsing) / `RESOLVED` (green) / `ESCALATED` (amber)
- **MTTR:** `71s`
- **Impact:** `~340% error rate spike · ~200 users affected · userImpactSeconds: 1420`

### 4.3 Incident Detail Page (`/dashboard/incidents/[id]`)

**Full-page incident view — the "war room you never had to enter."**

#### Timeline Strip (horizontal, top)
```
[Detected 14:28:00] → [Rolled Back 14:28:03] → [Diagnosed 14:28:08] → [Fix Verified 14:28:44] → [Promoted 14:28:45] → [Immunised 14:28:46]
         ↑ 3s                    ↑ 5s                  ↑ 36s                  ↑ 1s                   ↑ 1s
```
Each node is clickable → scrolls to that section below.

#### Section A — Detection
- Baseline delta: `error rate +340% from learned baseline`
- Triggering request (captured): full HTTP request object (method, path, headers, body) in a code block
- `baselineDelta: 3.4` · `severity: critical` · `blast-radius: checkout, orders`

#### Section B — Containment
- `Auto-rollback triggered at 14:28:01`
- `Rolled back to commit: a3f9b3c (last healthy build)`
- `Users restored: 3s after divergence`

#### Section C — Causal Chain
Numbered, expandable list:
```
1. Deploy #12 introduced null-ref in checkout handler   [evidenceRef: log-1234]
2. POST /checkout with empty cart triggered the fault   [evidenceRef: req-capture-01]
3. Null reference at checkout.ts:142 threw 500          [evidenceRef: trace-5678]
4. Error rate exceeded baseline by 340%                 [evidenceRef: metric-snap-01]
```
Each step has an `evidenceRef` badge that expands to show the raw evidence.

#### Section D — Fix (Shadow)
- Patch diff viewer (before/after code)
- Shadow proof: `replayedCases: 15 · intendedFixPassed: true · regressions: 0 · verdict: PROMOTE`
- Button: `👁 View Full Shadow Proof`

#### Section E — Voice Report
- Waveform player with the Sarvam Bulbul-generated audio briefing
- Transcript: `"Incident resolved. Deploy #12 introduced a null-reference at checkout.ts line 142. Auto-rollback contained the blast in 3 seconds. Fix verified in Shadow across 15 cases. Promoted and immunised. Total user impact: 71 seconds."`
- **🎤 Ask a follow-up** — mic button → STT → answer displayed + spoken

#### Section F — Antibody
- Antibody ID, minted timestamp, regression test snippet, runtimeAssertion, `recurrencesBlocked: 0`

---

## PAGE 5 — GENOME (`/dashboard/genome`)

**Purpose:** Show intent-code alignment across all modules.

### 5.1 Header
- Overall pairing score: large `84%` gauge
- `5 modules · 2 drifted · 1 compliance invariant unmatched`

### 5.2 Module Grid

Each module shown as a card:
- **Module name** (e.g. `checkout.ts`)
- **Pairing score ring** (0–100% as circle)
- **Status:** `PAIRED ✓` (green) / `DRIFTED ⚠` (amber) / `COMPLIANCE BREACH ✗` (red)
- **Last checked:** timestamp

### 5.3 Drift Detail Drawer

When clicking a drifted module:

**Intent Strand panel:**
- `purpose:` — the stored intent description
- `invariants:` — list of rules, each with: rule text · rationale · compliance flag · paired status
  - `✓ PAIRED` in green
  - `✗ UNPAIRED` in red (with diff link)
- `edgeDecisions:` — list

**Code panel:**
- Side-by-side diff showing the code that violates the invariant
- Highlighted lines where the invariant is broken

**Proposed correction:**
- Sarvam-generated minimal fix
- `→ Apply via Shadow` button (routes to Shadow verification)

**Specific demo case:**
```
Module: checkout.ts
Invariant #3: "Refunds over threshold require approval"  [compliance: true]
Status: UNPAIRED ✗
Diff: lines 88-92 — approval step removed in last commit
```

---

## PAGE 6 — METABOLISM (`/dashboard/metabolism`)

**Purpose:** Show codebase entropy over time and the rewrite risk projection.

### 6.1 Temperature Gauge (hero widget)
- Large arc gauge (think speedometer), 0–100
- Current: `62°`
- Zones: 0–40 (green "healthy") · 40–70 (amber "warming") · 70–100 (red "critical")
- Under gauge: `Projected rewrite cliff: 14 weeks at current rate`

### 6.2 Entropy Dimensions (5 bars)
Each dimension from the data model, shown as a horizontal bar with current value:

| Dimension | Value | Description |
|---|---|---|
| Duplication | `34%` | Repeated implementations |
| Pattern Variance | `28%` | Inconsistent coding patterns |
| Coupling | `41%` | Tight inter-module dependencies |
| Vuln Density | `12%` | Vulnerability surface area |
| Comprehension | `55%` | How hard it is to understand |

### 6.3 Temperature History Chart
- Line chart — temperature over time (x = date, y = 0–100)
- Two events annotated: `Duplication burst ↑` and `Enzyme ran ↓`
- Demo shows the curve rising then bending down

### 6.4 Repair Enzyme Panel
- List of queued/completed enzyme runs
- Each shows: type (`consolidator`) · target files · status (`pending` / `shadow-verified` / `promoted`) · before/after temperature
- `▶ Run Consolidator Now` button (P2 feature, shown greyed if not built)

---

## PAGE 7 — SHADOW PROOFS (`/dashboard/shadow`)

**Purpose:** Complete audit trail of every promotion gate.

### 7.1 Header Stats
- Total proofs: `12`
- Promoted: `11` (green)
- Rejected: `1` (red)
- Invariant: `No promotion without a stored PROMOTE proof`

### 7.2 Proof Table

Columns: `Proof ID · Change Ref · Replayed Cases · Intended Fix Passed · Regressions · Verdict · Verified At`

- `verdict: PROMOTE` → green row
- `verdict: REJECT` → red row, expandable to show what regressed

### 7.3 Proof Detail Drawer
For each proof:
- Full `ShadowProof` object displayed
- List of replayed cases with pass/fail per case
- The intended fix case highlighted
- Any regressions listed with diff

---

## PAGE 8 — ANTIBODY LIBRARY (`/dashboard/antibodies`)

**Purpose:** The immune memory — every permanent defence ever minted.

### 8.1 Header
- **Big number:** `48 antibodies` — with tagline: `"Every one of these is a threat that can never land again."`
- `Recurrences blocked: 3` (total across all antibodies)

### 8.2 Antibody Table/Grid

Each antibody card (grid view):
- **Antibody ID** (short hash)
- **Source type pill:** `vuln` (red shield) or `incident` (amber lightning)
- **Signature:** short description of what it guards against
- **Minted at:** timestamp
- **Recurrences blocked:** number (highlights if > 0)
- `→ View` expands to full detail

### 8.3 Antibody Detail
- **Full signature** text
- **Regression test** code block (fails on vulnerable behaviour, passes after fix)
- **Runtime assertion** code block
- **Embedding** (shown as a vector dimension visualisation or just stated: `768-dim vector · Atlas Vector Search indexed`)
- **Recurrence log:** any times this antibody fired and blocked

### 8.4 Vector Recall Panel
- Search box: `Test a new threat signature against immune memory`
- Enter a description → shows top-N matching antibodies by vector similarity with match score
- Demonstrates semantic recall even for slightly different attacks

---

## PAGE 9 — SETTINGS (`/settings`)

### Sections:
1. **Target App** — URL, allowlist, scan schedule
2. **Shadow Twin** — shadow URL, traffic samples, isolation status
3. **API Keys** — Sarvam, Gemini (masked, with test button)
4. **MongoDB** — connection string, collection status, vector index status
5. **n8n** — webhook base, workflow status (Immune: active / Resurrection: active)
6. **Sovereign Mode** — toggle `HELIX_SOVEREIGN` — routes all AI to local open-weight endpoint
7. **Notifications** — voice briefing on/off, language selector (for Bulbul TTS)

---

## CROSS-CUTTING UI PATTERNS

### Status Pills (used everywhere)
| State | Colour | Style |
|---|---|---|
| `open` / `ACTIVE` | Red | Solid + pulsing dot |
| `patching` / `HEALING` | Amber | Spinner |
| `healed` / `STABLE` | Green | Static check |
| `PROMOTE` | Green | Bold |
| `REJECT` | Red | Bold |
| `UNPAIRED` | Amber | Warning icon |

### Real-time Updates
- All data on the dashboard uses **Server-Sent Events (SSE)** from `/api/stream/*`
- Organ cards re-render without page refresh
- Activity stream entries animate in from the top

### Expandable Evidence Panels
Every autonomous action (detection, patch, proof, antibody) is inspectable:
`Cause → Evidence → Fix → Proof → Antibody`
This is accessible from a `Details →` link on every card.

### Voice Features (Sarvam integration)
- 🔊 **Speak Status** button on top bar → calls `/api/voice/briefing` → streams Bulbul audio
- 🎤 **Ask a follow-up** mic button on incident pages → Saaras STT → LLM answer → Bulbul speaks
- Text fallback shown below the audio player always

### Empty States
- No findings: `🛡️ All clear. HELIX found nothing exploitable. (Yet — next scan in 18 min)`
- No incidents: `💓 No incidents recorded. Last deploy was healthy.`
- No drift: `🧬 All modules paired. Genome is intact.`

---

## DATA DISPLAYED PER COLLECTION (what feeds each widget)

| MongoDB Collection | Dashboard widget | Fields shown |
|---|---|---|
| `entropy_timeseries` | Temperature card, Metabolism page | `temperature`, `projectedRewriteWeeks`, `dims.*`, `ts` |
| `intent_strand` | Genetic Integrity card, Genome page | `pairing.score`, `pairing.unpairedInvariants`, `invariants`, `moduleId` |
| `vulnerability` | Immune Status card, Immune page | `class`, `endpoint`, `status`, `detectedAt`, `healedAt`, `reAttack`, `evidence`, `patchRef`, `antibodyId` |
| `antibody` | Antibody count banner, Antibody page | `antibodyId`, `signature`, `sourceType`, `regressionTest`, `runtimeAssertion`, `recurrencesBlocked`, `mintedAt` |
| `incident` | Heart Rate card, Incidents page | all fields: `incidentId`, `deployId`, `detectedAt`, `baselineDelta`, `rollbackAt`, `causalChain`, `userImpactSeconds`, `shadowProof`, `antibodyId` |
| `shadow_proof` | Shadow page, proof drawers | `proofId`, `changeRef`, `replayedCases`, `intendedFixPassed`, `regressions`, `verdict`, `verifiedAt` |
| `homeostasis` | Governor panel (if built) | `generationRate`, `repairRate`, `balance`, `action`, `hottestZones`, `window` |

---

## THE DEMO EXPERIENCE (how judges see it)

**Demo 1 — Security Self-Heal (watch the immune system)**
1. Open `/dashboard` — show Vital Signs
2. Hit `Run Immune Scan`
3. Watch Activity Stream: SQLi detected → confirming → patching in Shadow → re-attack closed → antibody minted
4. Immune Status card: `2 open → 1 open → 0 open` (live update)
5. Antibody count: `47 → 48`

**Demo 2 — Resurrection Reflex (midnight deploy saves itself)**
1. Push a breaking deploy (via demo script)
2. Heart Rate card turns amber → `INCIDENT ACTIVE`
3. Activity stream: divergence detected → rolled back (3s) → causal chain → healing in Shadow → promoted
4. Incident detail page — show full timeline and causal chain
5. Click 🔊 `Speak Status` — Bulbul says: *"Incident resolved. 71 seconds total. Antibody minted."*
6. Ask a spoken follow-up — Saaras transcribes → spoken answer

**Demo 3 — Genome Drift (silent compliance rule drop)**
1. Apply the refund-approval commit
2. Genome card turns amber: `83% → 82% · 1 compliance invariant UNPAIRED`
3. Open Genome page → checkout.ts → see the diff + unpaired invariant highlighted

---

*Built for HackrPrix · Team Hi-iq · HELIX — AI made software grow at machine speed. We made it stay alive at machine speed.*
