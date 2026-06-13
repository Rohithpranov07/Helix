import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError, VerificationError } from "@helix/shared";
import type { Incident, ShadowProof } from "@helix/shared";
import type { HelixDoc } from "@helix/db";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockConnectDb, mockUpdateIncident, mockMkdirSync, mockWriteFileSync } =
  vi.hoisted(() => ({
    mockConnectDb: vi.fn().mockResolvedValue(undefined),
    mockUpdateIncident: vi.fn(),
    mockMkdirSync: vi.fn(),
    mockWriteFileSync: vi.fn(),
  }));

vi.mock("@helix/db", () => ({
  connectDb: mockConnectDb,
  updateIncident: mockUpdateIncident,
}));

vi.mock("fs", () => ({
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
}));

import { healIncident, type HealIncidentDeps, type IncidentSynthResult } from "../nervous/heal.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeIncident(overrides: Partial<Incident> = {}): HelixDoc<Incident> {
  return {
    _id: "inc-mongo-001",
    incidentId: "inc-1234567890-abc",
    deployId: "deploy-001",
    detectedAt: new Date().toISOString(),
    baselineDelta: 5000,
    userImpactSeconds: 120,
    rollbackAt: new Date().toISOString(),
    causalChain: [
      { order: 1, description: "SQL injection via search param", evidenceRef: "status:500" },
      { order: 2, description: "All rows returned to attacker", evidenceRef: "url:/api/products/search" },
    ],
    failingRequest: { url: "http://localhost:3001/api/products/search?q=1%27+OR+%271%27%3D%271", status: 500 },
    ...overrides,
  } as HelixDoc<Incident>;
}

function makeSynthResult(): IncidentSynthResult {
  return {
    patch: {
      files: [{ path: "apps/target/src/app/api/products/search/route.ts", diff: "--- a/...\n+++ b/...\n@@ -1 +1 @@\n-bad\n+good" }],
      rationale: "Replace string SQL with parameterized query",
    },
    inferredClass: "SQLi",
    endpoint: "/api/products/search",
  };
}

function makeProof(verdict: "promote" | "reject" = "promote"): ShadowProof {
  return {
    proofId: "proof-001",
    changeRef: "patch-ref-001",
    replayedCases: 2,
    intendedFixPassed: verdict === "promote",
    regressions: 0,
    verdict,
    verifiedAt: new Date().toISOString(),
  };
}

function makeDeps(overrides: Partial<HealIncidentDeps> = {}): HealIncidentDeps {
  return {
    synthesize: vi.fn().mockResolvedValue(makeSynthResult()),
    applyShadow: vi.fn().mockResolvedValue({ patchRef: "patch-ref-001", shadowUrl: "http://localhost:3002" }),
    verify: vi.fn().mockResolvedValue(makeProof("promote")),
    promote: vi.fn().mockResolvedValue(undefined),
    mint: vi.fn().mockResolvedValue("ab-001"),
    onEvent: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockConnectDb.mockClear();
  mockUpdateIncident.mockClear();
  mockMkdirSync.mockClear();
  mockWriteFileSync.mockClear();

  const incident = makeIncident();
  mockUpdateIncident.mockResolvedValue({
    ...incident,
    fixRef: "patch-ref-001",
    shadowProof: "proof-001",
    antibodyId: "ab-001",
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("healIncident — happy path", () => {
  it("returns outcome:healed with antibodyId", async () => {
    const deps = makeDeps();
    const result = await healIncident(makeIncident(), deps);

    expect(result.outcome).toBe("healed");
    expect(result.antibodyId).toBe("ab-001");
  });

  it("calls synthesize, applyShadow, verify, promote, mint in order", async () => {
    const order: string[] = [];
    const deps = makeDeps({
      synthesize: vi.fn().mockImplementation(async () => { order.push("synthesize"); return makeSynthResult(); }),
      applyShadow: vi.fn().mockImplementation(async () => { order.push("apply"); return { patchRef: "p-001", shadowUrl: "http://localhost:3002" }; }),
      verify: vi.fn().mockImplementation(async () => { order.push("verify"); return makeProof(); }),
      promote: vi.fn().mockImplementation(async () => { order.push("promote"); }),
      mint: vi.fn().mockImplementation(async () => { order.push("mint"); return "ab-001"; }),
    });

    await healIncident(makeIncident(), deps);

    expect(order).toEqual(["synthesize", "apply", "verify", "promote", "mint"]);
  });

  it("writes meta.json with inferredClass and endpoint for verifyEquivalence", async () => {
    const deps = makeDeps();
    await healIncident(makeIncident(), deps);

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining("patch-ref-001"),
      expect.stringContaining('"vulnClass":"SQLi"'),
      "utf8",
    );
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"endpoint":"/api/products/search"'),
      "utf8",
    );
  });

  it("writes meta.json with incident._id as findingId", async () => {
    const deps = makeDeps();
    await healIncident(makeIncident(), deps);

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"findingId":"inc-mongo-001"'),
      "utf8",
    );
  });

  it("updates incident with fixRef, shadowProof, antibodyId", async () => {
    const deps = makeDeps();
    await healIncident(makeIncident(), deps);

    expect(mockUpdateIncident).toHaveBeenCalledWith(
      "inc-mongo-001",
      expect.objectContaining({
        fixRef: "patch-ref-001",
        shadowProof: "proof-001",
        antibodyId: "ab-001",
      }),
    );
  });

  it("returns the updated incident from updateIncident", async () => {
    const deps = makeDeps();
    const result = await healIncident(makeIncident(), deps);

    expect(result.incident.fixRef).toBe("patch-ref-001");
    expect(result.incident.antibodyId).toBe("ab-001");
  });

  it("emits a healed event", async () => {
    const onEvent = vi.fn();
    await healIncident(makeIncident(), makeDeps({ onEvent }));

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "healed", incidentId: "inc-1234567890-abc" }),
    );
  });

  it("returns the proof in the result", async () => {
    const deps = makeDeps();
    const result = await healIncident(makeIncident(), deps);

    expect(result.proof?.verdict).toBe("promote");
    expect(result.proof?.proofId).toBe("proof-001");
  });
});

// ── Escalation — verify returns reject ───────────────────────────────────────

describe("healIncident — escalation (reject verdict)", () => {
  it("returns outcome:escalated when proof verdict is reject", async () => {
    const deps = makeDeps({
      verify: vi.fn().mockResolvedValue(makeProof("reject")),
      maxAttempts: 1,
    });

    const result = await healIncident(makeIncident(), deps);

    expect(result.outcome).toBe("escalated");
  });

  it("never calls promote when verdict is reject", async () => {
    const promote = vi.fn();
    const deps = makeDeps({
      verify: vi.fn().mockResolvedValue(makeProof("reject")),
      promote,
      maxAttempts: 1,
    });

    await healIncident(makeIncident(), deps);

    expect(promote).not.toHaveBeenCalled();
  });

  it("never calls mint when verdict is reject", async () => {
    const mint = vi.fn();
    const deps = makeDeps({
      verify: vi.fn().mockResolvedValue(makeProof("reject")),
      mint,
      maxAttempts: 1,
    });

    await healIncident(makeIncident(), deps);

    expect(mint).not.toHaveBeenCalled();
  });

  it("persists shadowProof proofId even on escalation", async () => {
    const deps = makeDeps({
      verify: vi.fn().mockResolvedValue(makeProof("reject")),
      maxAttempts: 1,
    });

    await healIncident(makeIncident(), deps);

    expect(mockUpdateIncident).toHaveBeenCalledWith(
      "inc-mongo-001",
      expect.objectContaining({ shadowProof: "proof-001" }),
    );
  });

  it("includes escalationReason in the result", async () => {
    const deps = makeDeps({
      verify: vi.fn().mockResolvedValue(makeProof("reject")),
      maxAttempts: 1,
    });

    const result = await healIncident(makeIncident(), deps);

    expect(result.escalationReason).toMatch(/reject/i);
  });

  it("emits an escalated event", async () => {
    const onEvent = vi.fn();
    const deps = makeDeps({
      verify: vi.fn().mockResolvedValue(makeProof("reject")),
      maxAttempts: 1,
      onEvent,
    });

    await healIncident(makeIncident(), deps);

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "escalated", incidentId: "inc-1234567890-abc" }),
    );
  });
});

// ── Retry on reject → success ─────────────────────────────────────────────────

describe("healIncident — retry logic", () => {
  it("retries synthesis on first reject and heals on second promote", async () => {
    const synthesize = vi.fn().mockResolvedValue(makeSynthResult());
    const verify = vi.fn()
      .mockResolvedValueOnce(makeProof("reject"))
      .mockResolvedValueOnce(makeProof("promote"));

    const deps = makeDeps({ synthesize, verify, maxAttempts: 2 });
    const result = await healIncident(makeIncident(), deps);

    expect(synthesize).toHaveBeenCalledTimes(2);
    expect(result.outcome).toBe("healed");
  });

  it("escalates after maxAttempts all reject", async () => {
    const verify = vi.fn().mockResolvedValue(makeProof("reject"));
    const deps = makeDeps({ verify, maxAttempts: 2 });

    const result = await healIncident(makeIncident(), deps);

    expect(result.outcome).toBe("escalated");
  });

  it("calls promote only once after successful retry", async () => {
    const promote = vi.fn().mockResolvedValue(undefined);
    const verify = vi.fn()
      .mockResolvedValueOnce(makeProof("reject"))
      .mockResolvedValueOnce(makeProof("promote"));
    const deps = makeDeps({ promote, verify, maxAttempts: 2 });

    await healIncident(makeIncident(), deps);

    expect(promote).toHaveBeenCalledTimes(1);
  });
});

// ── NOT_WIRED seams ───────────────────────────────────────────────────────────

// Base wired deps for NOT_WIRED tests — each test omits one to trigger the stub.
function wiredBase() {
  return {
    synthesize: vi.fn().mockResolvedValue(makeSynthResult()),
    applyShadow: vi.fn().mockResolvedValue({ patchRef: "p-001", shadowUrl: "http://localhost:3002" }),
    verify: vi.fn().mockResolvedValue(makeProof()),
    promote: vi.fn().mockResolvedValue(undefined as void),
    mint: vi.fn().mockResolvedValue("ab-001"),
    onEvent: vi.fn(),
  } as const;
}

describe("healIncident — NOT_WIRED seams", () => {
  it("throws ValidationError when applyShadow is not wired", async () => {
    const { synthesize, verify, promote, mint, onEvent } = wiredBase();
    const err = await healIncident(makeIncident(), { synthesize, verify, promote, mint, onEvent })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toMatch(/applyShadow/i);
  });

  it("throws ValidationError when verify is not wired", async () => {
    const { synthesize, applyShadow, promote, mint, onEvent } = wiredBase();
    const err = await healIncident(makeIncident(), { synthesize, applyShadow, promote, mint, onEvent })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toMatch(/verifyEquivalence/i);
  });

  it("throws ValidationError when promote is not wired", async () => {
    const { synthesize, applyShadow, verify, mint, onEvent } = wiredBase();
    const err = await healIncident(makeIncident(), { synthesize, applyShadow, verify, mint, onEvent })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toMatch(/promote/i);
  });

  it("throws ValidationError when mint is not wired", async () => {
    const { synthesize, applyShadow, verify, promote, onEvent } = wiredBase();
    const err = await healIncident(makeIncident(), { synthesize, applyShadow, verify, promote, onEvent })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toMatch(/mintAntibody/i);
  });
});

// ── VerificationError propagation ────────────────────────────────────────────

describe("healIncident — non-VerificationError propagates", () => {
  it("rethrows unexpected errors from verify (not a VerificationError)", async () => {
    const deps = makeDeps({
      verify: vi.fn().mockRejectedValue(new Error("network timeout")),
      maxAttempts: 1,
    });

    const err = await healIncident(makeIncident(), deps).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("network timeout");
    expect(err).not.toBeInstanceOf(VerificationError);
  });
});

// ── updateIncident fallback ───────────────────────────────────────────────────

describe("healIncident — updateIncident fallback", () => {
  it("returns original incident when updateIncident returns null", async () => {
    mockUpdateIncident.mockResolvedValue(null);
    const incident = makeIncident();
    const deps = makeDeps();

    const result = await healIncident(incident, deps);

    expect(result.incident._id).toBe("inc-mongo-001");
    expect(result.outcome).toBe("healed");
  });
});
