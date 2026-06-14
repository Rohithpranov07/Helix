import { z } from "zod";

// ---- shared field schemas (reuse across contracts) ----

const VulnClassSchema = z.enum(["SQLi", "XSS", "authBypass", "secretLeak", "missingRLS"]);
const VulnStatusSchema = z.enum(["open", "patching", "healed"]);
const AntibodySourceSchema = z.enum(["vuln", "incident"]);
const ShadowVerdictSchema = z.enum(["promote", "reject"]);
const GovernorActionSchema = z.enum(["ok", "reprioritise", "gate"]);

const InvariantSchema = z.object({
  id: z.string(),
  rule: z.string(),
  rationale: z.string(),
  compliance: z.boolean().optional(),
});

const IntentStrandSchema = z.object({
  moduleId: z.string(),
  purpose: z.string(),
  invariants: z.array(InvariantSchema),
  edgeDecisions: z.array(z.string()),
  sourcePrompt: z.string(),
  generatedBy: z.object({ model: z.string(), version: z.string() }),
  pairing: z.object({
    score: z.number(),
    lastChecked: z.string(),
    unpairedInvariants: z.array(z.string()),
  }),
});

const VulnerabilitySchema = z.object({
  class: VulnClassSchema,
  endpoint: z.string(),
  evidence: z.string(),
  patchRef: z.string().optional(),
  reAttack: z.object({
    before: z.enum(["open", "closed"]),
    after: z.enum(["open", "closed"]),
  }),
  antibodyId: z.string().optional(),
  status: VulnStatusSchema,
  detectedAt: z.string(),
  healedAt: z.string().optional(),
});

const AntibodySchema = z.object({
  antibodyId: z.string(),
  sourceType: AntibodySourceSchema,
  signature: z.string(),
  embedding: z.array(z.number()),
  regressionTest: z.string(),
  runtimeAssertion: z.string(),
  mintedAt: z.string(),
  recurrencesBlocked: z.number(),
});

const EntropyPointSchema = z.object({
  ts: z.string(),
  temperature: z.number(),
  dims: z.object({
    duplication: z.number(),
    patternVariance: z.number(),
    coupling: z.number(),
    vulnDensity: z.number(),
    comprehension: z.number(),
  }),
  projectedRewriteWeeks: z.number(),
});

const CausalStepSchema = z.object({
  order: z.number(),
  description: z.string(),
  evidenceRef: z.string(),
});

const IncidentSchema = z.object({
  incidentId: z.string(),
  deployId: z.string(),
  detectedAt: z.string(),
  baselineDelta: z.number(),
  rollbackAt: z.string().optional(),
  causalChain: z.array(CausalStepSchema),
  failingRequest: z.unknown(),
  shadowProof: z.string().optional(),
  fixRef: z.string().optional(),
  antibodyId: z.string().optional(),
  userImpactSeconds: z.number(),
});

const ShadowProofSchema = z.object({
  proofId: z.string(),
  changeRef: z.string(),
  replayedCases: z.number(),
  intendedFixPassed: z.boolean(),
  regressions: z.number(),
  verdict: ShadowVerdictSchema,
  verifiedAt: z.string(),
});

// ---- reflex contracts §B.3 ----

// scan.run
export const ScanRunReqSchema = z.object({ targetUrl: z.string().url() });
export const ScanRunResSchema = z.object({ findings: z.array(VulnerabilitySchema) });
export type ScanRunReq = z.infer<typeof ScanRunReqSchema>;
export type ScanRunRes = z.infer<typeof ScanRunResSchema>;

// vuln.heal
export const VulnHealReqSchema = z.object({ findingId: z.string() });
export const VulnHealResSchema = z.object({
  vulnerability: VulnerabilitySchema,
  proof: ShadowProofSchema.optional(),
});
export type VulnHealReq = z.infer<typeof VulnHealReqSchema>;
export type VulnHealRes = z.infer<typeof VulnHealResSchema>;

// incident.handle
export const IncidentHandleReqSchema = z.object({
  deployId: z.string(),
  signal: z.unknown(),
});
export const IncidentHandleResSchema = z.object({ incident: IncidentSchema });
export type IncidentHandleReq = z.infer<typeof IncidentHandleReqSchema>;
export type IncidentHandleRes = z.infer<typeof IncidentHandleResSchema>;

// incident.resolve
export const IncidentResolveReqSchema = z.object({ incidentId: z.string().min(1) });
export const IncidentResolveResSchema = z.object({
  incident: IncidentSchema,
  healed: z.array(z.string()),
  skipped: z.array(z.string()),
});
export type IncidentResolveReq = z.infer<typeof IncidentResolveReqSchema>;
export type IncidentResolveRes = z.infer<typeof IncidentResolveResSchema>;

// genome.pair
export const GenomePairReqSchema = z.object({ moduleId: z.string() });
export const GenomePairResSchema = z.object({
  strand: IntentStrandSchema,
  mismatches: z.array(z.string()),
});
export type GenomePairReq = z.infer<typeof GenomePairReqSchema>;
export type GenomePairRes = z.infer<typeof GenomePairResSchema>;

// entropy.measure
export const EntropyMeasureReqSchema = z.object({ repoPath: z.string() });
export const EntropyMeasureResSchema = z.object({ point: EntropyPointSchema });
export type EntropyMeasureReq = z.infer<typeof EntropyMeasureReqSchema>;
export type EntropyMeasureRes = z.infer<typeof EntropyMeasureResSchema>;

// governor.check
export const GovernorCheckReqSchema = z.object({ window: z.string().default("24h") });
export const GovernorCheckResSchema = z.object({
  homeostasis: z.object({
    window: z.string(),
    generationRate: z.number(),
    repairRate: z.number(),
    balance: z.number(),
    action: GovernorActionSchema,
    hottestZones: z.array(z.string()),
  }),
});
export type GovernorCheckReq = z.infer<typeof GovernorCheckReqSchema>;
export type GovernorCheckRes = z.infer<typeof GovernorCheckResSchema>;

// genome.index  — index a GitHub repository into intent strands
export const GenomeIndexReqSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  intentDocs: z.array(z.string()).default([]), // paths of PRD/spec files to use as intent
  intentDocsContent: z.array(z.string()).optional(), // actual text content of uploaded docs
});
export const GenomeIndexResSchema = z.object({
  strands: z.array(IntentStrandSchema),
  indexed: z.number(),
});
export type GenomeIndexReq = z.infer<typeof GenomeIndexReqSchema>;
export type GenomeIndexRes = z.infer<typeof GenomeIndexResSchema>;

// genome.drift  — detect code-vs-intent drift across a GitHub repo
export const GenomeDriftReqSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  moduleId: z.string().optional(), // if omitted, scan all indexed modules
});

const DriftMismatchSchema = z.object({
  invariantId: z.string(),
  description: z.string(),
  affectedFile: z.string(),
  diff: z.string(),
  newContent: z.string(),
});

const DriftStatusSchema = z.enum(["pending_approval", "approved", "rejected", "pr_created"]);

const DriftReportSchema = z.object({
  driftId: z.string(),
  strandId: z.string(),
  githubOwner: z.string(),
  githubRepo: z.string(),
  shadowBranch: z.string(),
  detectedAt: z.string(),
  mismatches: z.array(DriftMismatchSchema),
  status: DriftStatusSchema,
  prUrl: z.string().optional(),
  prNumber: z.number().optional(),
});

export const GenomeDriftResSchema = z.object({ report: DriftReportSchema });
export type GenomeDriftReq = z.infer<typeof GenomeDriftReqSchema>;
export type GenomeDriftRes = z.infer<typeof GenomeDriftResSchema>;

// genome.approve  — human approves a drift report → commits patches → opens PR
export const GenomeApproveReqSchema = z.object({ driftId: z.string().min(1) });
export const GenomeApproveResSchema = z.object({
  prUrl: z.string(),
  prNumber: z.number(),
  report: DriftReportSchema,
});
export type GenomeApproveReq = z.infer<typeof GenomeApproveReqSchema>;
export type GenomeApproveRes = z.infer<typeof GenomeApproveResSchema>;

// genome.reject  — human rejects a drift report
export const GenomeRejectReqSchema = z.object({ driftId: z.string().min(1) });
export const GenomeRejectResSchema = z.object({ driftId: z.string(), status: DriftStatusSchema });
export type GenomeRejectReq = z.infer<typeof GenomeRejectReqSchema>;
export type GenomeRejectRes = z.infer<typeof GenomeRejectResSchema>;

export { DriftMismatchSchema, DriftReportSchema, DriftStatusSchema };

// ── Immune System repo-aware scan + patch contracts ──────────────────────────

const ImmunePatchStatusSchema = z.enum([
  "pending_approval", "approved", "rejected", "pr_created",
]);

const ImmuneFindingSchema = z.object({
  vulnClass: VulnClassSchema,
  endpoint: z.string(),
  evidence: z.string(),
  affectedFile: z.string(),
  diff: z.string(),
  newContent: z.string(),
});

const ImmuneScanRunSchema = z.object({
  scanId: z.string(),
  githubOwner: z.string(),
  githubRepo: z.string(),
  shadowBranch: z.string(),
  scannedAt: z.string(),
  findings: z.array(ImmuneFindingSchema),
  status: ImmunePatchStatusSchema,
  prUrl: z.string().optional(),
  prNumber: z.number().optional(),
});

// immune.scan  — static analysis scan + patch synthesis for a connected repo
export const ImmuneScanReqSchema = z.object({
  githubOwner: z.string().min(1),
  githubRepo: z.string().min(1),
});
export const ImmuneScanResSchema = z.object({ scan: ImmuneScanRunSchema });
export type ImmuneScanReq = z.infer<typeof ImmuneScanReqSchema>;
export type ImmuneScanRes = z.infer<typeof ImmuneScanResSchema>;

// immune.patches  — list scan runs
export const ImmuneListReqSchema = z.object({
  githubOwner: z.string().optional(),
  githubRepo: z.string().optional(),
  status: ImmunePatchStatusSchema.optional(),
});
export const ImmuneListResSchema = z.object({ scans: z.array(ImmuneScanRunSchema) });
export type ImmuneListReq = z.infer<typeof ImmuneListReqSchema>;
export type ImmuneListRes = z.infer<typeof ImmuneListResSchema>;

// immune.approve  — human approves → writes files to shadow branch → PR → mint antibodies
export const ImmuneApproveReqSchema = z.object({ scanId: z.string().min(1) });
export const ImmuneApproveResSchema = z.object({
  prUrl: z.string(),
  prNumber: z.number(),
  scan: ImmuneScanRunSchema,
});
export type ImmuneApproveReq = z.infer<typeof ImmuneApproveReqSchema>;
export type ImmuneApproveRes = z.infer<typeof ImmuneApproveResSchema>;

// immune.reject  — human rejects
export const ImmuneRejectReqSchema = z.object({ scanId: z.string().min(1) });
export const ImmuneRejectResSchema = z.object({ scanId: z.string(), status: ImmunePatchStatusSchema });
export type ImmuneRejectReq = z.infer<typeof ImmuneRejectReqSchema>;
export type ImmuneRejectRes = z.infer<typeof ImmuneRejectResSchema>;

export { ImmuneScanRunSchema, ImmuneFindingSchema, ImmunePatchStatusSchema };

// ── Nervous System Railway Patch contracts ────────────────────────────────────

const IncidentPatchStatusSchema = z.enum([
  "pending_approval", "approved", "rejected", "pr_created",
]);

const IncidentPatchFileSchema = z.object({
  path: z.string(),
  diff: z.string(),
  newContent: z.string(),
});

const IncidentPatchSchema = z.object({
  patchId: z.string(),
  incidentId: z.string(),
  githubOwner: z.string(),
  githubRepo: z.string(),
  railwayProjectId: z.string(),
  railwayDeploymentId: z.string(),
  deploymentStatus: z.string(),
  shadowBranch: z.string(),
  detectedAt: z.string(),
  failureSummary: z.string(),
  causalChain: z.array(CausalStepSchema),
  files: z.array(IncidentPatchFileSchema),
  status: IncidentPatchStatusSchema,
  prUrl: z.string().optional(),
  prNumber: z.number().optional(),
});

// railway.projects  — list Railway projects visible to the token
export const RailwayProjectsReqSchema = z.object({});
export const RailwayProjectsResSchema = z.object({
  projects: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })),
});
export type RailwayProjectsReq = z.infer<typeof RailwayProjectsReqSchema>;
export type RailwayProjectsRes = z.infer<typeof RailwayProjectsResSchema>;

// railway.check  — detect latest failed deployment and synthesize patch
export const RailwayCheckReqSchema = z.object({
  projectId: z.string().min(1),
  githubOwner: z.string().min(1),
  githubRepo: z.string().min(1),
});
export const RailwayCheckResSchema = z.object({
  patch: IncidentPatchSchema,
});
export type RailwayCheckReq = z.infer<typeof RailwayCheckReqSchema>;
export type RailwayCheckRes = z.infer<typeof RailwayCheckResSchema>;

// incident.patches  — list incident patches (optionally filtered)
export const IncidentPatchesReqSchema = z.object({
  githubOwner: z.string().optional(),
  githubRepo: z.string().optional(),
  status: IncidentPatchStatusSchema.optional(),
});
export const IncidentPatchesResSchema = z.object({
  patches: z.array(IncidentPatchSchema),
});
export type IncidentPatchesReq = z.infer<typeof IncidentPatchesReqSchema>;
export type IncidentPatchesRes = z.infer<typeof IncidentPatchesResSchema>;

// incident.approve  — human approves → writes files to shadow branch → opens PR
export const IncidentApproveReqSchema = z.object({ patchId: z.string().min(1) });
export const IncidentApproveResSchema = z.object({
  prUrl: z.string(),
  prNumber: z.number(),
  patch: IncidentPatchSchema,
});
export type IncidentApproveReq = z.infer<typeof IncidentApproveReqSchema>;
export type IncidentApproveRes = z.infer<typeof IncidentApproveResSchema>;

// incident.reject  — human rejects a patch
export const IncidentRejectReqSchema = z.object({ patchId: z.string().min(1) });
export const IncidentRejectResSchema = z.object({
  patchId: z.string(),
  status: IncidentPatchStatusSchema,
});
export type IncidentRejectReq = z.infer<typeof IncidentRejectReqSchema>;
export type IncidentRejectRes = z.infer<typeof IncidentRejectResSchema>;

export { IncidentPatchSchema, IncidentPatchStatusSchema, IncidentPatchFileSchema };

// ── Metabolism GitHub repo-aware entropy digestion contracts ─────────────────

const MetabolismStatusSchema = z.enum(["pending_approval", "approved", "rejected", "pr_created"]);

const MetabolismEnzymeSchema = z.object({
  enzymeType: z.enum(["consolidator", "normaliser", "annealer"]),
  targetZone: z.string(),
  rationale: z.string(),
  diff: z.string(),
  newContent: z.string(),
});

const MetabolismRunSchema = z.object({
  runId: z.string(),
  githubOwner: z.string(),
  githubRepo: z.string(),
  shadowBranch: z.string(),
  measuredAt: z.string(),
  temperature: z.number(),
  dims: z.object({
    duplication: z.number(),
    patternVariance: z.number(),
    coupling: z.number(),
    vulnDensity: z.number(),
    comprehension: z.number(),
  }),
  projectedRewriteWeeks: z.number(),
  enzymes: z.array(MetabolismEnzymeSchema),
  status: MetabolismStatusSchema,
  prUrl: z.string().optional(),
  prNumber: z.number().optional(),
});

// metabolism.scan
export const MetabolismScanReqSchema = z.object({
  githubOwner: z.string().min(1),
  githubRepo: z.string().min(1),
});
export const MetabolismScanResSchema = z.object({ run: MetabolismRunSchema });
export type MetabolismScanReq = z.infer<typeof MetabolismScanReqSchema>;
export type MetabolismScanRes = z.infer<typeof MetabolismScanResSchema>;

// metabolism.list
export const MetabolismListReqSchema = z.object({
  githubOwner: z.string().optional(),
  githubRepo: z.string().optional(),
  status: MetabolismStatusSchema.optional(),
});
export const MetabolismListResSchema = z.object({ runs: z.array(MetabolismRunSchema) });
export type MetabolismListReq = z.infer<typeof MetabolismListReqSchema>;
export type MetabolismListRes = z.infer<typeof MetabolismListResSchema>;

// metabolism.approve
export const MetabolismApproveReqSchema = z.object({ runId: z.string().min(1) });
export const MetabolismApproveResSchema = z.object({
  prUrl: z.string(),
  prNumber: z.number(),
  run: MetabolismRunSchema,
});
export type MetabolismApproveReq = z.infer<typeof MetabolismApproveReqSchema>;
export type MetabolismApproveRes = z.infer<typeof MetabolismApproveResSchema>;

// metabolism.reject
export const MetabolismRejectReqSchema = z.object({ runId: z.string().min(1) });
export const MetabolismRejectResSchema = z.object({
  runId: z.string(),
  status: MetabolismStatusSchema,
});
export type MetabolismRejectReq = z.infer<typeof MetabolismRejectReqSchema>;
export type MetabolismRejectRes = z.infer<typeof MetabolismRejectResSchema>;

export { MetabolismRunSchema, MetabolismStatusSchema, MetabolismEnzymeSchema };

// re-export sub-schemas for use in other packages
export {
  VulnClassSchema,
  VulnStatusSchema,
  AntibodySourceSchema,
  ShadowVerdictSchema,
  GovernorActionSchema,
  InvariantSchema,
  IntentStrandSchema,
  VulnerabilitySchema,
  AntibodySchema,
  EntropyPointSchema,
  CausalStepSchema,
  IncidentSchema,
  ShadowProofSchema,
};
