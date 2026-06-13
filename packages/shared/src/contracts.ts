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
