/**
 * T8.1 — Governor: homeostasis check
 *
 * checkHomeostasis(window, deps?):
 *   1. Reads recent vulnerabilities (opened vs healed within the window).
 *   2. Reads recent incidents (opened vs resolved within the window).
 *   3. Reads the latest EntropyPoint for temperature + dims.
 *   4. Computes generationRate, repairRate, balance.
 *   5. Identifies hottestZones from open vulns + entropy dims.
 *   6. Decides action: "ok" | "reprioritise" | "gate".
 *   7. Persists a Homeostasis record and returns it.
 *
 * Action thresholds (§9):
 *   gate         — temperature ≥ 0.8  OR  balance ≤ −3
 *                  OR any critical-class (SQLi/authBypass) vuln is open
 *   reprioritise — temperature ≥ 0.5  OR  balance < 0  OR  any open vuln
 *   ok           — otherwise
 *
 * All five query seams are injectable so the function is fully testable
 * without a live DB or network.
 */
import { z } from "zod";
import {
  connectDb,
  listVulnerabilities,
  listIncidents,
  listEntropyPoints,
  createHomeostasis,
} from "@helix/db";
import type { HelixDoc } from "@helix/db";
import type { Vulnerability, Incident, EntropyPoint, Homeostasis, GovernorAction } from "@helix/shared";
import { ValidationError } from "@helix/shared";

// ── Window parsing ────────────────────────────────────────────────────────────

const WINDOW_RE = /^(\d+)(h|d|w)$/;

export function parseWindowMs(window: string): number {
  const m = WINDOW_RE.exec(window);
  if (!m) throw new ValidationError(`Invalid window format "${window}" — expected e.g. "24h", "7d", "2w".`);
  const n = parseInt(m[1]!, 10);
  const unit = m[2]!;
  if (unit === "h") return n * 60 * 60 * 1000;
  if (unit === "d") return n * 24 * 60 * 60 * 1000;
  return n * 7 * 24 * 60 * 60 * 1000; // w
}

// ── Action thresholds ─────────────────────────────────────────────────────────

const GATE_TEMP = 0.8;
const GATE_BALANCE = -3;
const REPRIORITISE_TEMP = 0.5;
const CRITICAL_CLASSES = new Set<string>(["SQLi", "authBypass"]);

// ── Public types ──────────────────────────────────────────────────────────────

export interface CheckHomeostasisDeps {
  /** Returns all vulnerability docs — filter by detectedAt/healedAt in this fn. */
  listVulns?: () => Promise<HelixDoc<Vulnerability>[]>;
  /** Returns all incident docs — filter by detectedAt/rollbackAt in this fn. */
  listIncidents?: () => Promise<HelixDoc<Incident>[]>;
  /** Returns the most recent entropy point, or null if none. */
  latestEntropy?: () => Promise<HelixDoc<EntropyPoint> | null>;
  /** Persists the Homeostasis record. */
  persist?: (data: Homeostasis) => Promise<HelixDoc<Homeostasis>>;
}

// ── Zod: validate window input ────────────────────────────────────────────────

const WindowSchema = z.string().regex(WINDOW_RE, 'window must match /^\\d+(h|d|w)$/ e.g. "24h"');

// ── checkHomeostasis ──────────────────────────────────────────────────────────

export async function checkHomeostasis(
  window: string,
  deps?: CheckHomeostasisDeps,
): Promise<HelixDoc<Homeostasis>> {
  await connectDb();

  const parsed = WindowSchema.safeParse(window);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid window format "${window}" — expected e.g. "24h", "7d", "2w".`,
    );
  }
  const windowMs = parseWindowMs(window);
  const since = new Date(Date.now() - windowMs);

  const {
    listVulns = () => listVulnerabilities(),
    listIncidents: getIncidents = () => listIncidents(),
    latestEntropy = async () => {
      const pts = await listEntropyPoints(1);
      return pts[0] ?? null;
    },
    persist = (data: Homeostasis) => createHomeostasis(data),
  } = deps ?? {};

  // ── 1. Fetch all vulns and incidents ─────────────────────────────────────
  const [vulns, incidents, entropy] = await Promise.all([
    listVulns(),
    getIncidents(),
    latestEntropy(),
  ]);

  // ── 2. Window filter ──────────────────────────────────────────────────────
  const vulnsInWindow = vulns.filter(
    (v) => new Date(v.detectedAt) >= since,
  );
  const healedInWindow = vulns.filter(
    (v) => v.healedAt != null && new Date(v.healedAt) >= since,
  );
  const incidentsInWindow = incidents.filter(
    (i) => new Date(i.detectedAt) >= since,
  );
  const resolvedInWindow = incidents.filter(
    (i) => i.rollbackAt != null && new Date(i.rollbackAt) >= since,
  );

  // ── 3. Rates ──────────────────────────────────────────────────────────────
  const generationRate = vulnsInWindow.length + incidentsInWindow.length;
  const repairRate = healedInWindow.length + resolvedInWindow.length;
  const balance = repairRate - generationRate;

  // ── 4. Temperature ────────────────────────────────────────────────────────
  const temperature = entropy?.temperature ?? 0;

  // ── 5. Hot zones — open vulns by endpoint + highest-dim entropy zone ──────
  const openVulns = vulns.filter((v) => v.status === "open" || v.status === "patching");
  const zoneSet = new Set<string>();

  for (const v of openVulns) {
    zoneSet.add(`${v.endpoint} [${v.class}]`);
  }

  // Add the entropy-hottest dim name if temperature is elevated
  if (entropy && temperature >= REPRIORITISE_TEMP) {
    const dims = entropy.dims;
    const topDim = (Object.entries(dims) as Array<[string, number]>).sort(
      (a, b) => b[1] - a[1],
    )[0];
    if (topDim) zoneSet.add(`entropy:${topDim[0]} (${topDim[1].toFixed(2)})`);
  }

  const hottestZones = [...zoneSet].slice(0, 5);

  // ── 6. Action decision ────────────────────────────────────────────────────
  const hasCriticalOpen = openVulns.some((v) => CRITICAL_CLASSES.has(v.class));

  let action: GovernorAction;
  if (temperature >= GATE_TEMP || balance <= GATE_BALANCE || hasCriticalOpen) {
    action = "gate";
  } else if (temperature >= REPRIORITISE_TEMP || balance < 0 || openVulns.length > 0) {
    action = "reprioritise";
  } else {
    action = "ok";
  }

  // ── 7. Persist + return ───────────────────────────────────────────────────
  const record: Homeostasis = {
    window,
    generationRate,
    repairRate,
    balance,
    action,
    hottestZones,
  };

  const stored = await persist(record);

  // eslint-disable-next-line no-console
  console.log(
    `[governor] window=${window} generationRate=${generationRate} repairRate=${repairRate} ` +
      `balance=${balance >= 0 ? "+" : ""}${balance} temperature=${temperature.toFixed(3)} ` +
      `action=${action} hottestZones=${hottestZones.join(", ") || "none"}`,
  );

  return stored;
}
