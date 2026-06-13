import type {
  ScanRunReq, ScanRunRes,
  VulnHealReq, VulnHealRes,
  IncidentHandleReq, IncidentHandleRes,
  GenomePairReq, GenomePairRes,
  EntropyMeasureReq, EntropyMeasureRes,
} from "@helix/shared";

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
  const { vulnerability, proof } = await healVulnerability(req.findingId, {
    applyShadow: (f, p) => applyInShadow(f, p, applyToShadow),
    mint: async (finding) => {
      const ab = await mintAntibody({ type: "vuln", ref: finding._id });
      return ab.antibodyId;
    },
  });
  return proof ? { vulnerability, proof } : { vulnerability };
}

export async function incidentHandle(_req: IncidentHandleReq): Promise<IncidentHandleRes> {
  return {
    incident: {
      incidentId: "stub-" + Date.now(),
      deployId: _req.deployId,
      detectedAt: new Date().toISOString(),
      baselineDelta: 0,
      causalChain: [],
      failingRequest: _req.signal,
      userImpactSeconds: 0,
    },
  };
}

export async function genomePair(_req: GenomePairReq): Promise<GenomePairRes> {
  return {
    strand: {
      moduleId: _req.moduleId,
      purpose: "stub — T6.1",
      invariants: [],
      edgeDecisions: [],
      sourcePrompt: "stub",
      generatedBy: { model: "stub", version: "0" },
      pairing: { score: 0, lastChecked: new Date().toISOString(), unpairedInvariants: [] },
    },
    mismatches: [],
  };
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
