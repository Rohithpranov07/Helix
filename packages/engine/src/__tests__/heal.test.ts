import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError, VerificationError, type Vulnerability, type ShadowProof } from "@helix/shared";
import type { HelixDoc } from "@helix/db";

// Mock external deps before importing heal.ts
const dbState: { vuln: HelixDoc<Vulnerability> } = {
  vuln: {
    _id: "vuln-001",
    class: "SQLi",
    endpoint: "/api/products/search",
    evidence: "CONFIRMED SQLi differential",
    reAttack: { before: "open", after: "open" },
    status: "open",
    detectedAt: new Date().toISOString(),
  },
};

vi.mock("@helix/db", () => ({
  connectDb: vi.fn().mockResolvedValue(undefined),
  findVulnerabilityById: vi.fn(async (id: string) =>
    id === dbState.vuln._id ? dbState.vuln : null,
  ),
  updateVulnerability: vi.fn(async (id: string, patch: Partial<Vulnerability>) => {
    if (id === dbState.vuln._id) dbState.vuln = { ...dbState.vuln, ...patch };
    return dbState.vuln;
  }),
}));

// confirm.ts and patch.ts pull these — keep them inert; we inject via deps anyway.
vi.mock("@helix/ai", () => ({ groq: { chat: vi.fn() } }));

import { healVulnerability, assertPromotable, type HealDeps, type HealRecord } from "../immune/heal.js";
import { updateVulnerability } from "@helix/db";

function resetVuln() {
  dbState.vuln = {
    _id: "vuln-001",
    class: "SQLi",
    endpoint: "/api/products/search",
    evidence: "CONFIRMED SQLi differential",
    reAttack: { before: "open", after: "open" },
    status: "open",
    detectedAt: new Date().toISOString(),
  };
}

function proof(verdict: ShadowProof["verdict"]): ShadowProof {
  return {
    proofId: "proof-001",
    changeRef: "shadow-change-1",
    replayedCases: 8,
    intendedFixPassed: verdict === "promote",
    regressions: verdict === "promote" ? 0 : 2,
    verdict,
    verifiedAt: new Date().toISOString(),
  };
}

/** A fully-wired happy-path deps bag; individual tests override pieces. */
function happyDeps(over: Partial<HealDeps> = {}): HealDeps {
  return {
    confirm: vi.fn().mockResolvedValue(true), // exploitable on target; closed handled by reAttack
    synthesize: vi.fn().mockResolvedValue({
      files: [{ path: "apps/target/src/app/api/products/search/route.ts", diff: "--- a\n+++ b\n@@\n-x\n+y" }],
      rationale: "parameterized query",
    }),
    applyShadow: vi.fn().mockResolvedValue({ patchRef: "shadow-change-1", shadowUrl: "http://localhost:3002" }),
    reAttack: vi.fn().mockResolvedValue({ closed: true, newlyFired: [] }),
    verify: vi.fn().mockResolvedValue(proof("promote")),
    mint: vi.fn().mockResolvedValue("ab-001"),
    promote: vi.fn().mockResolvedValue(undefined),
    onHealEvent: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  resetVuln();
  vi.mocked(updateVulnerability).mockClear();
});

describe("healVulnerability — happy path", () => {
  it("heals: confirm → patch → re-attack closed → promote → antibody", async () => {
    const deps = happyDeps();
    const { vulnerability, proof: p } = await healVulnerability("vuln-001", deps);

    expect(deps.promote).toHaveBeenCalledOnce();
    expect(deps.mint).toHaveBeenCalledOnce();
    expect(p?.verdict).toBe("promote");
    expect(vulnerability.status).toBe("healed");
    expect(vulnerability.reAttack).toEqual({ before: "open", after: "closed" });
    expect(vulnerability.healedAt).toBeDefined();
    expect(vulnerability.antibodyId).toBe("ab-001");

    const events = vi.mocked(deps.onHealEvent!).mock.calls.map((c) => c[0] as HealRecord);
    expect(events.at(-1)!.outcome).toBe("healed");
  });

  it("writes all heal fields in a single updateVulnerability call (no double-write)", async () => {
    const deps = happyDeps();
    await healVulnerability("vuln-001", deps);

    // applyInShadow records status:'patching' + patchRef (call 1)
    // the final heal records all remaining fields (call 2) — total = 2 calls
    const calls = vi.mocked(updateVulnerability).mock.calls;

    // The heal-completion call must include status, reAttack, healedAt, antibodyId in one go.
    const healCall = calls.find((c) =>
      (c[1] as Partial<typeof dbState.vuln>).status === "healed",
    );
    expect(healCall).toBeDefined();
    const healFields = healCall![1] as Record<string, unknown>;
    expect(healFields["reAttack"]).toEqual({ before: "open", after: "closed" });
    expect(healFields["healedAt"]).toBeDefined();
    expect(healFields["antibodyId"]).toBe("ab-001");

    // Must NOT have a separate updateVulnerability with only antibodyId.
    const antibodyOnlyCall = calls.find(
      (c) =>
        Object.keys(c[1] as object).length === 1 &&
        "antibodyId" in (c[1] as object),
    );
    expect(antibodyOnlyCall).toBeUndefined();
  });
});

describe("healVulnerability — Shadow invariant", () => {
  it("does NOT promote when verdict is 'reject'", async () => {
    const deps = happyDeps({ verify: vi.fn().mockResolvedValue(proof("reject")), maxAttempts: 1 });
    const { vulnerability } = await healVulnerability("vuln-001", deps);

    expect(deps.promote).not.toHaveBeenCalled();
    expect(deps.mint).not.toHaveBeenCalled();
    expect(vulnerability.status).not.toBe("healed");
  });

  it("does NOT promote when the re-attack still reproduces the hole", async () => {
    const deps = happyDeps({
      reAttack: vi.fn().mockResolvedValue({ closed: false, newlyFired: [] }),
      maxAttempts: 1,
    });
    const { vulnerability } = await healVulnerability("vuln-001", deps);

    expect(deps.verify).not.toHaveBeenCalled();
    expect(deps.promote).not.toHaveBeenCalled();
    expect(vulnerability.status).not.toBe("healed");
  });

  it("does NOT promote when the patch fixes the hole but a new detector fires", async () => {
    const deps = happyDeps({
      reAttack: vi.fn().mockResolvedValue({ closed: true, newlyFired: ["XSS"] }),
      maxAttempts: 1,
    });
    const { vulnerability } = await healVulnerability("vuln-001", deps);

    expect(deps.promote).not.toHaveBeenCalled();
    expect(vulnerability.status).not.toBe("healed");
  });
});

describe("healVulnerability — retry + escalate", () => {
  it("retries synthesis after a reject, then succeeds", async () => {
    const verify = vi
      .fn()
      .mockResolvedValueOnce(proof("reject"))
      .mockResolvedValueOnce(proof("promote"));
    const deps = happyDeps({ verify, maxAttempts: 2 });

    const { vulnerability } = await healVulnerability("vuln-001", deps);

    expect(verify).toHaveBeenCalledTimes(2);
    expect(deps.synthesize).toHaveBeenCalledTimes(2);
    expect(deps.promote).toHaveBeenCalledOnce();
    expect(vulnerability.status).toBe("healed");
  });

  it("escalates after exhausting attempts without a promotable proof", async () => {
    const deps = happyDeps({ verify: vi.fn().mockResolvedValue(proof("reject")), maxAttempts: 2 });
    const { vulnerability } = await healVulnerability("vuln-001", deps);

    expect(deps.synthesize).toHaveBeenCalledTimes(2);
    expect(deps.promote).not.toHaveBeenCalled();
    expect(vulnerability.status).not.toBe("healed");

    const events = vi.mocked(deps.onHealEvent!).mock.calls.map((c) => c[0] as HealRecord);
    expect(events.at(-1)!.outcome).toBe("escalated");
  });
});

describe("healVulnerability — guards", () => {
  it("discards a finding that no longer reproduces (not exploitable)", async () => {
    const deps = happyDeps({ confirm: vi.fn().mockResolvedValue(false) });
    const { vulnerability } = await healVulnerability("vuln-001", deps);

    expect(deps.synthesize).not.toHaveBeenCalled();
    expect(deps.promote).not.toHaveBeenCalled();
    expect(vulnerability.status).toBe("open");
  });

  it("throws when the finding id does not exist", async () => {
    await expect(healVulnerability("missing", happyDeps())).rejects.toThrow(ValidationError);
  });

  it("throws when verify is not wired (T4.2 absent)", async () => {
    // Provide everything up to verify, but leave verify on its throwing default.
    const deps: HealDeps = {
      confirm: vi.fn().mockResolvedValue(true),
      synthesize: vi.fn().mockResolvedValue({
        files: [{ path: "apps/target/x.ts", diff: "d" }],
        rationale: "r",
      }),
      applyShadow: vi.fn().mockResolvedValue({ patchRef: "c1", shadowUrl: "http://localhost:3002" }),
      reAttack: vi.fn().mockResolvedValue({ closed: true, newlyFired: [] }),
      onHealEvent: vi.fn(),
      // verify / mint / promote omitted → default throws (T4.2/T3.1 not built)
    };
    await expect(healVulnerability("vuln-001", deps)).rejects.toThrow(ValidationError);
  });

  it("throws when applyShadow is not wired (T4.1 absent) — Shadow invariant holds", async () => {
    // No applyShadow injected → defaults to applyInShadow's throwing stub.
    // Confirm this propagates through the orchestrator without touching real target.
    const deps: HealDeps = {
      confirm: vi.fn().mockResolvedValue(true),
      synthesize: vi.fn().mockResolvedValue({
        files: [{ path: "apps/target/src/app/api/products/search/route.ts", diff: "--- a\n+++ b\n@@ -1 +1 @@\n-x\n+y" }],
        rationale: "parameterized query",
      }),
      onHealEvent: vi.fn(),
      // applyShadow omitted → throws before any DB promotion write
    };
    await expect(healVulnerability("vuln-001", deps)).rejects.toThrow(ValidationError);
    // The vulnerability must remain 'open' — no promotion occurred.
    expect(dbState.vuln.status).not.toBe("healed");
  });
});

describe("assertPromotable", () => {
  it("passes for verdict:'promote'", () => {
    expect(() => assertPromotable(proof("promote"))).not.toThrow();
  });
  it("throws VerificationError for verdict:'reject'", () => {
    expect(() => assertPromotable(proof("reject"))).toThrow(VerificationError);
  });
});
