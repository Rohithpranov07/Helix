import type {
  ScanRunReq, ScanRunRes,
  VulnHealReq, VulnHealRes,
  IncidentHandleReq, IncidentHandleRes,
  IncidentResolveReq, IncidentResolveRes,
  GenomePairReq, GenomePairRes,
  EntropyMeasureReq, EntropyMeasureRes,
  GovernorCheckReq, GovernorCheckRes,
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
export { measureEntropy, computeTemperature, computeProjectedWeeks } from "./metabolism/temperature.js";
export type { MeasureEntropyDeps } from "./metabolism/temperature.js";
export { consolidate } from "./metabolism/consolidator.js";
export type {
  Duplication, ConsolidateDeps, ConsolidateResult,
  ConsolidateEvent, ConsolidateOutcome,
} from "./metabolism/consolidator.js";
export { checkHomeostasis, parseWindowMs } from "./governor/homeostasis.js";
export type { CheckHomeostasisDeps } from "./governor/homeostasis.js";
export {
  pairGenome,
  NOT_WIRED_VERIFY_CORRECTION,
  inferVulnClassFromInvariant,
  parsePatchFilePath,
} from "./genome/pair.js";
export type { PairMismatch, CorrectionProposal, PairGenomeResult, PairGenomeDeps } from "./genome/pair.js";
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
  const { pairGenome: _pairGenome, inferVulnClassFromInvariant, parsePatchFilePath } = await import("./genome/pair.js");
  const { applyToShadow } = await import("./shadow/runtime.js");
  const { verifyEquivalence } = await import("./shadow/verify.js");
  const { writeFileSync, mkdirSync } = await import("fs");
  const { resolve } = await import("path");

  const REPO_ROOT = resolve(__dirname, "../../..");
  const SHADOW_STAGING = resolve(REPO_ROOT, "shadow/staging");

  const result = await _pairGenome(req.moduleId, {
    // ── SHADOW GATE ──────────────────────────────────────────────────────────
    // Wire verifyCorrection to the real Shadow chain:
    //   1. Parse the unified diff to extract the target file path.
    //   2. Build a Patch object and apply it to the Shadow twin only.
    //   3. Write staging meta.json so verifyEquivalence can resolve class + endpoint.
    //   4. Run verifyEquivalence: replay traffic, Sarvam judges, persist shadow_proof.
    //   5. Return the proof — caller attaches it to the CorrectionProposal.
    // The real target is NEVER written here. Only the Shadow twin is touched.
    verifyCorrection: async (proposal) => {
      const filePath = parsePatchFilePath(proposal.suggestedPatch);
      if (!filePath) {
        throw new Error(
          `verifyCorrection: cannot parse file path from suggestedPatch for ${proposal.invariantId}`,
        );
      }

      const patch = {
        files: [{ path: filePath, diff: proposal.suggestedPatch }],
        rationale: proposal.explanation,
      };

      // Apply to Shadow only — never the real target.
      const applied = await applyToShadow(patch);

      // Write meta.json so verifyEquivalence can build the right traffic cases.
      const vulnClass = inferVulnClassFromInvariant(
        proposal.invariantRule,
        proposal.invariantCompliance,
      );
      const endpoint = `/${filePath.split("/").slice(-1)[0]?.replace(/\.(tsx?|jsx?)$/, "") ?? "check"}`;
      mkdirSync(resolve(SHADOW_STAGING, applied.patchRef), { recursive: true });
      writeFileSync(
        resolve(SHADOW_STAGING, applied.patchRef, "meta.json"),
        JSON.stringify({ findingId: proposal.invariantId, vulnClass, endpoint }),
        "utf8",
      );

      // Verify equivalence — Sarvam judges whether the fix holds without regressions.
      return verifyEquivalence(applied.patchRef);
    },
  });

  return {
    strand: result.strand,
    mismatches: result.mismatches.map(
      (m) =>
        `${m.invariantId}: [${m.type}] ${m.description} — ${m.evidenceRef}` +
        (result.corrections.find((c) => c.invariantId === m.invariantId)?.promotable
          ? " ✓ correction Shadow-verified"
          : ""),
    ),
  };
}

export async function governorCheck(req: GovernorCheckReq): Promise<GovernorCheckRes> {
  const { checkHomeostasis: _check } = await import("./governor/homeostasis.js");
  const homeostasis = await _check(req.window ?? "24h");
  return { homeostasis };
}

export async function entropyMeasure(req: EntropyMeasureReq): Promise<EntropyMeasureRes> {
  const { measureEntropy: _measureEntropy } = await import("./metabolism/temperature.js");
  const { resolve } = await import("path");
  const REPO_ROOT = resolve(__dirname, "../../..");
  const repoPath = resolve(REPO_ROOT, req.repoPath);
  const point = await _measureEntropy(repoPath);
  return { point };
}
