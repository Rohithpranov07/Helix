// ----- enums -----
export type VulnClass = "SQLi" | "XSS" | "authBypass" | "secretLeak" | "missingRLS";
export type VulnStatus = "open" | "patching" | "healed";
export type AntibodySource = "vuln" | "incident";
export type ShadowVerdict = "promote" | "reject";
export type GovernorAction = "ok" | "reprioritise" | "gate";

// ----- Genome §3 : intent_strand -----
export interface Invariant {
  id: string;
  rule: string;
  rationale: string;
  compliance?: boolean;
}
export interface IntentStrand {
  moduleId: string;
  purpose: string;
  invariants: Invariant[];
  edgeDecisions: string[];
  sourcePrompt: string;
  generatedBy: { model: string; version: string };
  pairing: { score: number; lastChecked: string; unpairedInvariants: string[] };
}

// ----- Immune System §4 : vulnerability -----
export interface Vulnerability {
  class: VulnClass;
  endpoint: string;
  evidence: string;
  patchRef?: string;
  reAttack: { before: "open" | "closed"; after: "open" | "closed" };
  antibodyId?: string;
  status: VulnStatus;
  detectedAt: string;
  healedAt?: string;
}

// ----- Immune Memory §5 : antibody (vector-indexed) -----
export interface Antibody {
  antibodyId: string;
  sourceType: AntibodySource;
  signature: string;
  embedding: number[];
  regressionTest: string;
  runtimeAssertion: string;
  mintedAt: string;
  recurrencesBlocked: number;
}

// ----- Metabolism §6 : entropy_timeseries (time-series collection) -----
export interface EntropyPoint {
  ts: string;
  temperature: number;
  dims: {
    duplication: number;
    patternVariance: number;
    coupling: number;
    vulnDensity: number;
    comprehension: number;
  };
  projectedRewriteWeeks: number;
}

// ----- Nervous System / Resurrection §7 : incident -----
export interface CausalStep {
  order: number;
  description: string;
  evidenceRef: string;
}
export interface Incident {
  incidentId: string;
  deployId: string;
  detectedAt: string;
  baselineDelta: number;
  rollbackAt?: string;
  causalChain: CausalStep[];
  failingRequest: unknown;
  shadowProof?: string; // proofId
  fixRef?: string;
  antibodyId?: string;
  userImpactSeconds: number;
}

// ----- Shadow §8 : shadow_proof -----
export interface ShadowProof {
  proofId: string;
  changeRef: string;
  replayedCases: number;
  intendedFixPassed: boolean;
  regressions: number;
  verdict: ShadowVerdict;
  verifiedAt: string;
}

// ----- Governor §9 : homeostasis -----
export interface Homeostasis {
  window: string;
  generationRate: number;
  repairRate: number;
  balance: number;
  action: GovernorAction;
  hottestZones: string[];
}

// ----- Genome §3 extended: GitHub drift detection -----
export type DriftStatus = "pending_approval" | "approved" | "rejected" | "pr_created";

export interface DriftMismatch {
  invariantId: string;
  description: string;
  affectedFile: string;
  diff: string;          // unified diff for human review
  newContent: string;    // full patched file content (written to shadow branch)
}

export interface DriftReport {
  driftId: string;
  strandId: string;
  githubOwner: string;
  githubRepo: string;
  shadowBranch: string;
  detectedAt: string;
  mismatches: DriftMismatch[];
  status: DriftStatus;
  prUrl?: string;
  prNumber?: number;
}

export interface GitHubConnection {
  owner: string;
  repo: string;
  accessToken: string;
  defaultBranch: string;
  connectedAt: string;
}
