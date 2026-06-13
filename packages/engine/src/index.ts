import type {
  ScanRunReq, ScanRunRes,
  VulnHealReq, VulnHealRes,
  IncidentHandleReq, IncidentHandleRes,
  IncidentResolveReq, IncidentResolveRes,
  GenomePairReq, GenomePairRes,
  EntropyMeasureReq, EntropyMeasureRes,
} from "@helix/shared";

export type { IncidentResolveReq, IncidentResolveRes } from "@helix/shared";

export { scanTarget } from "./immune/scanner.js";
export { confirmFinding } from "./immune/confirm.js";
export { synthesizePatch, applyInShadow, assertPatchSafe } from "./immune/patch.js";
export type { Patch, PatchFile, ShadowApplier, ShadowApplyResult } from "./immune/patch.js";
export { healVulnerability, assertPromotable } from "./immune/heal.js";
export type {
  HealDeps, HealResult, HealRecord, HealOutcome,
  ReAttacker, ReAttackResult, EquivalenceVerifier, AntibodyMinter, Promoter, ShadowApply,
} from "./immune/heal.js";
export { mintAntibody, makeAntibodyId, makeSignature } from "./memory/mint.js";
export type { MintSource } from "./memory/mint.js";
export { matchAntibody, blockRecurrence } from "./memory/recall.js";
export type { AntibodyMatch, RecurrenceReport } from "./memory/recall.js";
export { spinShadow, applyToShadow, replayTraffic } from "./shadow/runtime.js";
export type { TrafficCase, TrafficReplay } from "./shadow/runtime.js";
export { verifyEquivalence } from "./shadow/verify.js";
export { captureIntent, seedShopLite, SHOPLITE_MODULES } from "./genome/capture.js";
export { handleIncident } from "./nervous/incident.js";
export { resolveIncident, extractEndpoint } from "./nervous/resolve.js";
export type { ResolveResult, HealerFn, ResolveDeps } from "./nervous/resolve.js";
export { healIncident, synthesizeIncidentPatch } from "./nervous/heal.js";
export type { HealIncidentDeps, HealIncidentResult, HealIncidentEvent, HealIncidentOutcome, IncidentSynthResult } from "./nervous/heal.js";
export { promoteToTarget } from "./immune/promote.js";

// ── Reflex handlers ──────────────────────────────────────────────────────────

export async function scanRun(req: ScanRunReq): Promise<ScanRunRes> {
  const { scanTarget } = await import("./immune/scanner.js");
  const findings = await scanTarget(req.targetUrl);
  return { findings };
}

export async function vulnHeal(req: VulnHealReq): Promise<VulnHealRes> {
  const { healVulnerability } = await import("./immune/heal.js");
  const { mintAntibody } = await import("./memory/mint.js");
  const { applyInShadow } = await import("./immune/patch.js");
  const { applyToShadow } = await import("./shadow/runtime.js");
  const { verifyEquivalence } = await import("./shadow/verify.js");
  const { promoteToTarget } = await import("./immune/promote.js");
  const { vulnerability, proof } = await healVulnerability(req.findingId, {
    applyShadow: (f, p) => applyInShadow(f, p, applyToShadow),
    verify: (changeRef) => verifyEquivalence(changeRef),
    promote: (finding, patch) => promoteToTarget(finding, patch),
    mint: async (finding) => {
      const ab = await mintAntibody({ type: "vuln", ref: finding._id });
      return ab.antibodyId;
    },
  });
  return proof ? { vulnerability, proof } : { vulnerability };
}

export async function incidentHandle(req: IncidentHandleReq): Promise<IncidentHandleRes> {
  const { handleIncident } = await import("./nervous/incident.js");
  const { healIncident: _healIncident } = await import("./nervous/heal.js");
  const { mintAntibody: _mintAntibody } = await import("./memory/mint.js");
  const { applyToShadow } = await import("./shadow/runtime.js");
  const { verifyEquivalence } = await import("./shadow/verify.js");
  const { assertPatchSafe } = await import("./immune/patch.js");
  const { spawnSync } = await import("child_process");
  const { writeFileSync, mkdirSync } = await import("fs");
  const { resolve } = await import("path");

  const incident = await handleIncident(req);

  // Auto-heal when Sarvam recommended rollback — full autonomous cure loop.
  if (incident.rollbackAt) {
    try {
      const REPO_ROOT = resolve(__dirname, "../../..");
      const healed = await _healIncident(incident, {
        applyShadow: (patch) => applyToShadow(patch),
        verify: (changeRef) => verifyEquivalence(changeRef),
        promote: async (patch) => {
          // Apply the Shadow-proven diff to the real apps/target/ source tree.
          // Mirrors promoteToTarget logic without requiring a finding reference.
          assertPatchSafe(patch);
          const promoRef = `promote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const stagingDir = resolve(REPO_ROOT, "shadow/staging", promoRef);
          mkdirSync(stagingDir, { recursive: true });
          for (let i = 0; i < patch.files.length; i++) {
            const file = patch.files[i];
            if (!file) continue;
            const diffFile = resolve(stagingDir, `${i}.patch`);
            writeFileSync(diffFile, file.diff, "utf8");
            const r = spawnSync(
              "patch",
              ["-p1", "--no-backup-if-mismatch", "-i", diffFile],
              { cwd: REPO_ROOT, encoding: "utf8", timeout: 15_000 },
            );
            if (r.status !== 0) {
              throw new Error(
                `promote failed for ${file.path}:\n${r.stdout ?? ""}${r.stderr ?? ""}`,
              );
            }
          }
        },
        mint: async (incidentId) => {
          const ab = await _mintAntibody({ type: "incident", ref: incidentId });
          return ab.antibodyId;
        },
      });
      return { incident: healed.incident };
    } catch {
      // Non-fatal — the incident is recorded; heal failure is logged by healIncident.
    }
  }

  return { incident };
}

export async function incidentResolve(req: IncidentResolveReq): Promise<IncidentResolveRes> {
  const { resolveIncident } = await import("./nervous/resolve.js");
  const { healVulnerability } = await import("./immune/heal.js");
  const { mintAntibody } = await import("./memory/mint.js");
  const { applyInShadow } = await import("./immune/patch.js");
  const { applyToShadow } = await import("./shadow/runtime.js");
  const { verifyEquivalence } = await import("./shadow/verify.js");
  const { promoteToTarget } = await import("./immune/promote.js");

  return resolveIncident(req.incidentId, {
    heal: (findingId) =>
      healVulnerability(findingId, {
        applyShadow: (f, p) => applyInShadow(f, p, applyToShadow),
        verify: (changeRef) => verifyEquivalence(changeRef),
        promote: (finding, patch) => promoteToTarget(finding, patch),
        mint: async (finding) => {
          const ab = await mintAntibody({ type: "vuln", ref: finding._id });
          return ab.antibodyId;
        },
      }),
  });
}

export async function genomePair(req: GenomePairReq): Promise<GenomePairRes> {
  const { captureIntent: _captureIntent } = await import("./genome/capture.js");
  const strand = await _captureIntent(req.moduleId);
  return { strand, mismatches: [] };
}

export async function entropyMeasure(_req: EntropyMeasureReq): Promise<EntropyMeasureRes> {
  return {
    point: {
      ts: new Date().toISOString(),
      temperature: 0,
      dims: { duplication: 0, patternVariance: 0, coupling: 0, vulnDensity: 0, comprehension: 0 },
      projectedRewriteWeeks: 0,
    },
  };
}
