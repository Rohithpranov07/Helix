/**
 * T2.4 — Re-attack confirmation + promote (Immune System cure loop)
 *
 * healVulnerability orchestrates the full heal:
 *   confirm → synthesize → applyInShadow → re-attack the Shadow → verify
 *   equivalence → (only on verdict:'promote') promote → mint antibody.
 *
 * THE SHADOW INVARIANT IS INVIOLABLE: the patch is promoted to the real target
 * ONLY when a shadow_proof with verdict:'promote' exists. Every Shadow-dependent
 * step (apply, re-attack) and every not-yet-built dependency (T4.2 verify, T3.1
 * mint, the promoter) is an injectable seam so this orchestrator is testable now
 * and wires to the real organs as they land — without ever risking a real-target
 * write before proof.
 */
import {
  ValidationError,
  VerificationError,
  type Vulnerability,
  type VulnClass,
  type ShadowProof,
  type ShadowVerdict,
} from "@helix/shared";
import { connectDb, findVulnerabilityById, updateVulnerability } from "@helix/db";
import type { HelixDoc } from "@helix/db";
import { confirmFinding } from "./confirm.js";
import { synthesizePatch, applyInShadow, type Patch, type ShadowApplyResult } from "./patch.js";

// ── Seam contracts ────────────────────────────────────────────────────────────

/** Outcome of re-running the identical attack against the patched Shadow. */
export interface ReAttackResult {
  /** The original hole no longer reproduces against the Shadow. */
  closed: boolean;
  /** Other detector classes that newly fire after the patch — must be empty. */
  newlyFired: VulnClass[];
}

/** Re-run the T2.1/T2.2 attack against the patched Shadow twin. */
export type ReAttacker = (
  finding: HelixDoc<Vulnerability>,
  shadowUrl: string,
) => Promise<ReAttackResult>;

/** Behaviour-equivalence verification (T4.2). Records & returns a shadow_proof. */
export type EquivalenceVerifier = (changeRef: string) => Promise<ShadowProof>;

/** Antibody minting (T3.1). Returns the antibodyId set on the vulnerability. */
export type AntibodyMinter = (finding: HelixDoc<Vulnerability>) => Promise<string>;

/** Promote the proven patch to the real target (demo: write checkout / open PR). */
export type Promoter = (finding: HelixDoc<Vulnerability>, patch: Patch) => Promise<void>;

/** Apply a patch to the Shadow twin (T4.1). */
export type ShadowApply = (
  finding: HelixDoc<Vulnerability>,
  patch: Patch,
) => Promise<ShadowApplyResult>;

// ── Structured heal record (T2.4 req 4 — dashboard activity stream) ───────────

export type HealOutcome =
  | "healed"
  | "rejected"
  | "escalated"
  | "not-exploitable";

export interface HealRecord {
  findingId: string;
  class: VulnClass;
  endpoint: string;
  outcome: HealOutcome;
  attempts: number;
  patchRef?: string;
  proofId?: string;
  verdict?: ShadowVerdict;
  antibodyId?: string;
  detail: string;
  at: string;
}

// ── Dependency injection ──────────────────────────────────────────────────────

export interface HealDeps {
  /** Base URL of the REAL target for the initial (read-only) confirmation. */
  targetUrl?: string;
  /** Max synthesis attempts before escalating. */
  maxAttempts?: number;

  confirm?: (finding: HelixDoc<Vulnerability>, url: string) => Promise<boolean>;
  synthesize?: (finding: Vulnerability) => Promise<Patch>;
  applyShadow?: ShadowApply;
  reAttack?: ReAttacker;
  verify?: EquivalenceVerifier;
  mint?: AntibodyMinter;
  promote?: Promoter;
  onHealEvent?: (record: HealRecord) => void | Promise<void>;
}

const NOT_WIRED = (organ: string, task: string): never => {
  throw new ValidationError(
    `${organ} is not wired (${task} not yet built). ` +
      `healVulnerability requires it via HealDeps; it will NEVER promote without a verdict:'promote' proof.`,
  );
};

function resolveDeps(deps: HealDeps): Required<Omit<HealDeps, "onHealEvent">> & {
  onHealEvent: NonNullable<HealDeps["onHealEvent"]>;
} {
  const confirm = deps.confirm ?? confirmFinding;
  return {
    targetUrl: deps.targetUrl ?? process.env["TARGET_URL"] ?? "http://localhost:3001",
    maxAttempts: deps.maxAttempts ?? 2,
    confirm,
    synthesize: deps.synthesize ?? synthesizePatch,
    // Default applier uses applyInShadow's own throwing stub (T4.1 absent).
    // T4.1 wiring: (f, p) => applyInShadow(f, p, runtime.applyToShadow)
    // NOT: (f, p) => runtime.applyToShadow(p) — that bypasses assertPatchSafe.
    applyShadow: deps.applyShadow ?? ((f, p) => applyInShadow(f, p)),
    // Default re-attack replays the identical T2.2 attack against the Shadow.
    reAttack:
      deps.reAttack ??
      (async (finding, shadowUrl) => {
        const stillExploitable = await confirm(finding, shadowUrl);
        return { closed: !stillExploitable, newlyFired: [] };
      }),
    verify: deps.verify ?? (() => NOT_WIRED("verifyEquivalence", "T4.2")),
    mint: deps.mint ?? (() => NOT_WIRED("mintAntibody", "T3.1")),
    promote: deps.promote ?? (() => NOT_WIRED("promoter", "T2.4 promote target")),
    onHealEvent:
      deps.onHealEvent ??
      ((record) => {
        // eslint-disable-next-line no-console
        console.log("[heal]", JSON.stringify(record));
      }),
  };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export interface HealResult {
  vulnerability: Vulnerability;
  proof?: ShadowProof;
}

/**
 * Heals a confirmed vulnerability end-to-end through the Shadow. Promotes to the
 * real target ONLY on a shadow_proof with verdict:'promote'. On any failure the
 * target is left untouched, synthesis is retried up to maxAttempts, then escalated.
 */
export async function healVulnerability(
  findingId: string,
  deps: HealDeps = {},
): Promise<HealResult> {
  const d = resolveDeps(deps);

  await connectDb();
  const finding = await findVulnerabilityById(findingId);
  if (!finding) {
    throw new ValidationError(`Vulnerability ${findingId} not found`);
  }

  const emit = (
    outcome: HealOutcome,
    attempts: number,
    detail: string,
    extra: Partial<HealRecord> = {},
  ): Promise<void> | void =>
    d.onHealEvent({
      findingId,
      class: finding.class,
      endpoint: finding.endpoint,
      outcome,
      attempts,
      detail,
      at: new Date().toISOString(),
      ...extra,
    });

  // 1. Confirm exploitable (read-only, against the REAL target).
  const exploitable = await d.confirm(finding, d.targetUrl);
  if (!exploitable) {
    await emit("not-exploitable", 0, "Finding did not reproduce; discarded.");
    return { vulnerability: await reload(findingId, finding) };
  }

  let lastProof: ShadowProof | undefined;

  for (let attempt = 1; attempt <= d.maxAttempts; attempt++) {
    // 2. Synthesize a class-appropriate minimal patch (Sarvam).
    const patch = await d.synthesize(finding);

    // 3. Apply to the Shadow ONLY (sets status:'patching', patchRef). Never the real target.
    const applied = await d.applyShadow(finding, patch);

    // 4. Re-run the identical attack against the patched Shadow.
    const reatk = await d.reAttack(finding, applied.shadowUrl);
    if (!reatk.closed || reatk.newlyFired.length > 0) {
      await emit("rejected", attempt, reatk.closed
        ? `Patch closed the hole but newly fired: ${reatk.newlyFired.join(", ")}.`
        : "Patch did not close the hole in the Shadow.", { patchRef: applied.patchRef });
      continue; // retry synthesis
    }

    // 5. Behaviour-equivalence proof (T4.2). This records the shadow_proof.
    const proof = await d.verify(applied.patchRef);
    lastProof = proof;

    // 6. PROMOTION GATE — the Shadow invariant. No promotion without verdict:'promote'.
    if (proof.verdict !== "promote") {
      await emit("rejected", attempt,
        `Equivalence verdict was '${proof.verdict}'; promotion blocked.`,
        { patchRef: applied.patchRef, proofId: proof.proofId, verdict: proof.verdict });
      continue; // retry synthesis
    }

    // 7. Promote to the real target (demo: write checkout / open PR).
    await d.promote(finding, patch);

    // 8. Mint the antibody (T3.1).
    const antibodyId = await d.mint(finding);

    // 9. Record the full heal in one write: status, reAttack, patchRef, healedAt, antibodyId.
    const healedAt = new Date().toISOString();
    await updateVulnerability(findingId, {
      status: "healed",
      patchRef: applied.patchRef,
      reAttack: { before: "open", after: "closed" },
      healedAt,
      antibodyId,
    });

    await emit("healed", attempt, "Patched in Shadow, re-attack closed, proof promoted, antibody minted.", {
      patchRef: applied.patchRef,
      proofId: proof.proofId,
      verdict: proof.verdict,
      antibodyId,
    });

    return { vulnerability: await reload(findingId, finding), proof };
  }

  // Exhausted attempts without a promotable proof — escalate, target untouched.
  const escalationExtra: Partial<HealRecord> = lastProof
    ? { verdict: lastProof.verdict, proofId: lastProof.proofId }
    : {};
  await emit("escalated", d.maxAttempts,
    `No promotable patch after ${d.maxAttempts} attempt(s); escalating to human review.`,
    escalationExtra);

  const vulnerability = await reload(findingId, finding);
  return lastProof ? { vulnerability, proof: lastProof } : { vulnerability };
}

/** Re-fetch the vulnerability after mutations; fall back to the last snapshot. */
async function reload(
  findingId: string,
  fallback: HelixDoc<Vulnerability>,
): Promise<Vulnerability> {
  const fresh = await findVulnerabilityById(findingId);
  return fresh ?? fallback;
}

/**
 * Re-export so callers (T4.2 wiring) can assert the gate explicitly.
 * Throws VerificationError unless the proof promotes.
 */
export function assertPromotable(proof: ShadowProof): void {
  if (proof.verdict !== "promote") {
    throw new VerificationError(
      `Promotion blocked: shadow_proof ${proof.proofId} verdict is '${proof.verdict}'`,
    );
  }
}
