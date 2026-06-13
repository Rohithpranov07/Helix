/**
 * T5.3 — Incident resolution (Resurrection Reflex close-the-loop)
 *
 * resolveIncident: given an open incident, finds all vulnerabilities at the
 *   affected endpoint, heals each one through the full immune cycle, and
 *   updates the incident record with fixRef + antibodyId from the first
 *   successful heal.
 *
 * This is the final step of the Resurrection Reflex pipeline:
 *   handleIncident (T5.1) → heals via Shadow (T2–T4) → resolveIncident (T5.3)
 *
 * Injectable seam: `heal` defaults to a NOT_WIRED stub so the module is safe
 * to import before the Shadow runtime is available. Wire it in index.ts where
 * all four HealDeps are already assembled.
 */
import { z } from "zod";
import { ValidationError, type Incident, type Vulnerability, type ShadowProof } from "@helix/shared";
import {
  connectDb,
  findIncidentByIncidentId,
  findIncidentById,
  updateIncident,
  listVulnerabilities,
} from "@helix/db";
import type { HelixDoc } from "@helix/db";

// ── Seam contract ─────────────────────────────────────────────────────────────

export interface HealResult {
  vulnerability: Vulnerability;
  proof?: ShadowProof;
}

export type HealerFn = (findingId: string) => Promise<HealResult>;

export interface ResolveDeps {
  heal?: HealerFn;
}

const NOT_WIRED_HEAL: HealerFn = async () => {
  throw new ValidationError(
    "resolveIncident: heal seam is not wired. " +
      "Use incidentResolve() from index.ts which injects the full heal deps.",
  );
};

// ── Endpoint extraction ───────────────────────────────────────────────────────

const SignalUrlSchema = z
  .object({ url: z.string().optional(), path: z.string().optional(), endpoint: z.string().optional() })
  .passthrough();

/**
 * Extracts the URL path from the raw production signal.
 * Returns null when no URL-like field can be found.
 */
export function extractEndpoint(signal: unknown): string | null {
  const parsed = SignalUrlSchema.safeParse(signal);
  const raw = parsed.success
    ? (parsed.data.url ?? parsed.data.path ?? parsed.data.endpoint ?? null)
    : null;

  if (typeof raw !== "string" || raw.length === 0) return null;

  // Normalise: strip query string, keep path component only.
  try {
    const u = new URL(raw.startsWith("http") ? raw : `http://x${raw}`);
    return u.pathname;
  } catch {
    return raw.split("?")[0] ?? null;
  }
}

// ── resolveIncident ───────────────────────────────────────────────────────────

export interface ResolveResult {
  incident: HelixDoc<Incident>;
  /** _ids of vulnerabilities successfully healed in this call. */
  healed: string[];
  /** _ids of vulnerabilities skipped (heal failed or already in progress). */
  skipped: string[];
}

/**
 * Closes the Resurrection Reflex loop for an incident:
 *
 *  1. Fetches the incident (by incidentId string or MongoDB _id).
 *  2. Extracts the affected endpoint from the production signal.
 *  3. Finds open vulnerabilities at that endpoint (falls back to ALL open vulns
 *     if no endpoint can be extracted — safe for demo with few findings).
 *  4. Heals each via the injected `heal` seam (full immune cycle).
 *  5. On success: updates the incident with fixRef + antibodyId.
 *  6. Returns the updated incident + heal summary.
 *
 * Idempotent: already-healed vulns are skipped; the incident fixRef is only
 * written once (first successful heal wins; subsequent heals add to `healed` list
 * but do not overwrite fixRef).
 */
export async function resolveIncident(
  incidentId: string,
  deps: ResolveDeps = {},
): Promise<ResolveResult> {
  await connectDb();

  const heal = deps.heal ?? NOT_WIRED_HEAL;

  // 1. Fetch incident — accept both incidentId slugs and MongoDB _ids.
  const incident =
    (await findIncidentByIncidentId(incidentId)) ??
    (await findIncidentById(incidentId));

  if (!incident) {
    throw new ValidationError(`resolveIncident: incident '${incidentId}' not found`);
  }

  // 2. Extract affected endpoint from the production signal.
  const endpoint = extractEndpoint(incident.failingRequest);

  // 3. Find open vulnerabilities at the affected endpoint.
  let openVulns: HelixDoc<Vulnerability>[];
  if (endpoint) {
    openVulns = await listVulnerabilities({ endpoint, status: "open" } as Partial<Vulnerability>);
    // If no exact match found, broaden to all open vulns (small set for demo).
    if (openVulns.length === 0) {
      openVulns = await listVulnerabilities({ status: "open" } as Partial<Vulnerability>);
    }
  } else {
    openVulns = await listVulnerabilities({ status: "open" } as Partial<Vulnerability>);
  }

  // 4. Heal each open vulnerability.
  const healed: string[] = [];
  const skipped: string[] = [];
  let firstFixRef: string | undefined;
  let firstAntibodyId: string | undefined;

  for (const vuln of openVulns) {
    try {
      const result = await heal(vuln._id);
      healed.push(vuln._id);

      // Capture fix metadata from the first successful heal.
      if (!firstFixRef) {
        firstFixRef =
          (result.vulnerability as Vulnerability & { patchRef?: string }).patchRef;
        firstAntibodyId =
          (result.vulnerability as Vulnerability & { antibodyId?: string }).antibodyId;
      }
    } catch {
      skipped.push(vuln._id);
    }
  }

  // 5. Update the incident with fix references (only if something was healed).
  let updatedIncident = incident;
  if (firstFixRef !== undefined || firstAntibodyId !== undefined) {
    const update: Partial<Incident> = {};
    if (firstFixRef) update.fixRef = firstFixRef;
    if (firstAntibodyId) update.antibodyId = firstAntibodyId;
    updatedIncident = (await updateIncident(incident._id, update)) ?? incident;
  }

  // eslint-disable-next-line no-console
  console.log(
    `[resolve] incident:${incident.incidentId} | healed:${healed.length} | ` +
      `skipped:${skipped.length} | endpoint:${endpoint ?? "unknown"}`,
  );

  return { incident: updatedIncident, healed, skipped };
}
