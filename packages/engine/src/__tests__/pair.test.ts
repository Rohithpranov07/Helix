import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "@helix/shared";
import type { IntentStrand, ShadowProof } from "@helix/shared";
import type { HelixDoc } from "@helix/db";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const {
  mockConnectDb,
  mockListIntentStrands,
  mockUpdateIntentStrand,
  mockGeminiAnalyze,
  mockSarvamChat,
  mockReadFileSync,
  mockExistsSync,
} = vi.hoisted(() => ({
  mockConnectDb: vi.fn().mockResolvedValue(undefined),
  mockListIntentStrands: vi.fn(),
  mockUpdateIntentStrand: vi.fn(),
  mockGeminiAnalyze: vi.fn(),
  mockSarvamChat: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
}));

vi.mock("@helix/db", () => ({
  connectDb: mockConnectDb,
  listIntentStrands: mockListIntentStrands,
  updateIntentStrand: mockUpdateIntentStrand,
}));

vi.mock("@helix/ai", () => ({
  gemini: { analyze: mockGeminiAnalyze },
  sarvam: { chat: mockSarvamChat },
}));

vi.mock("fs", () => ({
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
}));

import {
  pairGenome,
  NOT_WIRED_VERIFY_CORRECTION,
  inferVulnClassFromInvariant,
  parsePatchFilePath,
} from "../genome/pair.js";
import type { CorrectionProposal } from "../genome/pair.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MODULE_ID = "apps/target/src/app/admin/orders/page.tsx";
const MOCK_CODE = `
export default async function AdminOrdersPage() {
  const supabase = getSupabase();
  const { data } = await supabase.from("orders").select("*");
  return <div>{JSON.stringify(data)}</div>;
}`.trim();

const SUGGESTED_PATCH = [
  "--- a/apps/target/src/app/admin/orders/page.tsx",
  "+++ b/apps/target/src/app/admin/orders/page.tsx",
  "@@ -1,3 +1,6 @@",
  "+if (amount > REFUND_THRESHOLD && !hasApproval(orderId)) {",
  "+  return NextResponse.json({ error: 'approval_required' }, { status: 403 });",
  "+}",
].join("\n");

function makeStrand(overrides: Partial<IntentStrand> = {}): HelixDoc<IntentStrand> {
  return {
    _id: "strand-001",
    moduleId: MODULE_ID,
    purpose: "Admin order management including refund processing.",
    invariants: [
      {
        id: "inv-1",
        rule: "Unauthenticated requests must be rejected with 401/403.",
        rationale: "Authorization boundary.",
        compliance: false,
      },
      {
        id: "inv-2",
        rule: "All high-value operations above the configured threshold require explicit approval.",
        rationale: "Regulatory requirement: dual-control for high-value transactions.",
        compliance: true,
      },
      {
        id: "inv-3",
        rule: "Order data must be scoped to the requesting user via RLS.",
        rationale: "Data isolation requirement.",
        compliance: false,
      },
    ],
    edgeDecisions: ["Falls back to mock data when Supabase is unavailable."],
    sourcePrompt: "PR: Admin order page",
    generatedBy: { model: "sarvam-m", version: "1" },
    pairing: { score: 1.0, lastChecked: "2026-01-01T00:00:00.000Z", unpairedInvariants: [] },
    ...overrides,
  } as HelixDoc<IntentStrand>;
}

function makeGeminiOutput(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    pairedInvariants: ["inv-1", "inv-3"],
    unpairedInvariants: [
      {
        id: "inv-2",
        type: "code-drift",
        evidenceRef: "No approval gate found before order mutation; refund processed directly.",
      },
    ],
    score: 0.67,
    rationale: "Auth and RLS present; approval workflow absent.",
    ...overrides,
  });
}

function makeSarvamCorrection(): string {
  return JSON.stringify({
    explanation:
      "The code processes refunds without checking for an approval record. The inv-2 compliance invariant requires a dual-control gate before any high-value mutation.",
    suggestedPatch: SUGGESTED_PATCH,
  });
}

function makeProof(verdict: "promote" | "reject" = "promote"): ShadowProof {
  return {
    proofId: `proof-${verdict}-001`,
    changeRef: "shadow-genome-001",
    replayedCases: 2,
    intendedFixPassed: verdict === "promote",
    regressions: 0,
    verdict,
    verifiedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  mockConnectDb.mockClear();
  mockListIntentStrands.mockClear();
  mockUpdateIntentStrand.mockClear();
  mockGeminiAnalyze.mockClear();
  mockSarvamChat.mockClear();
  mockReadFileSync.mockClear();
  mockExistsSync.mockClear();

  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue(MOCK_CODE);
  mockListIntentStrands.mockResolvedValue([makeStrand()]);
  mockUpdateIntentStrand.mockResolvedValue(makeStrand());
  mockGeminiAnalyze.mockResolvedValue({ content: makeGeminiOutput() });
  mockSarvamChat.mockResolvedValue({ content: makeSarvamCorrection() });
});

// ── Happy path — mismatch detection ──────────────────────────────────────────

describe("pairGenome — mismatch detection", () => {
  it("returns the strand from the database", async () => {
    const result = await pairGenome(MODULE_ID);
    expect(result.strand._id).toBe("strand-001");
    expect(result.strand.moduleId).toBe(MODULE_ID);
  });

  it("returns the score from Gemini output", async () => {
    const result = await pairGenome(MODULE_ID);
    expect(result.score).toBeCloseTo(0.67);
  });

  it("returns structured PairMismatch for each unpaired invariant", async () => {
    const result = await pairGenome(MODULE_ID);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]?.invariantId).toBe("inv-2");
    expect(result.mismatches[0]?.type).toBe("code-drift");
    expect(result.mismatches[0]?.evidenceRef).toContain("approval gate");
  });

  it("populates mismatch description from the invariant rule", async () => {
    const result = await pairGenome(MODULE_ID);
    expect(result.mismatches[0]?.description).toContain("approval");
  });

  it("returns empty mismatches when all invariants are paired", async () => {
    mockGeminiAnalyze.mockResolvedValue({
      content: JSON.stringify({
        pairedInvariants: ["inv-1", "inv-2", "inv-3"],
        unpairedInvariants: [],
        score: 1.0,
        rationale: "All invariants satisfied.",
      }),
    });
    const result = await pairGenome(MODULE_ID);
    expect(result.mismatches).toHaveLength(0);
    expect(result.score).toBe(1.0);
  });

  it("handles multiple mismatches", async () => {
    mockGeminiAnalyze.mockResolvedValue({
      content: JSON.stringify({
        pairedInvariants: ["inv-3"],
        unpairedInvariants: [
          { id: "inv-1", type: "code-drift", evidenceRef: "No auth check found." },
          { id: "inv-2", type: "code-drift", evidenceRef: "No approval gate found." },
        ],
        score: 0.33,
        rationale: "Auth and approval both absent.",
      }),
    });
    const result = await pairGenome(MODULE_ID);
    expect(result.mismatches).toHaveLength(2);
    expect(result.corrections).toHaveLength(2);
  });

  it("flags intent-drift type correctly", async () => {
    mockGeminiAnalyze.mockResolvedValue({
      content: JSON.stringify({
        pairedInvariants: ["inv-1", "inv-3"],
        unpairedInvariants: [
          { id: "inv-2", type: "intent-drift", evidenceRef: "Invariant added after code was frozen." },
        ],
        score: 0.67,
        rationale: "inv-2 is newer than the code.",
      }),
    });
    const result = await pairGenome(MODULE_ID);
    expect(result.mismatches[0]?.type).toBe("intent-drift");
  });
});

// ── Correction proposals — proposal shape ────────────────────────────────────

describe("pairGenome — correction proposal shape", () => {
  it("correction carries invariantRule from the intent strand", async () => {
    const result = await pairGenome(MODULE_ID);
    expect(result.corrections[0]?.invariantRule).toContain("approval");
  });

  it("correction carries invariantCompliance flag from the invariant", async () => {
    const result = await pairGenome(MODULE_ID);
    expect(result.corrections[0]?.invariantCompliance).toBe(true);
  });

  it("always sets requiresShadowVerification:true on corrections", async () => {
    const result = await pairGenome(MODULE_ID);
    for (const c of result.corrections) {
      expect(c.requiresShadowVerification).toBe(true);
    }
  });

  it("correction explanation comes from Sarvam", async () => {
    const result = await pairGenome(MODULE_ID);
    expect(result.corrections[0]?.explanation).toContain("approval record");
  });

  it("correction suggestedPatch contains a unified diff", async () => {
    const result = await pairGenome(MODULE_ID);
    expect(result.corrections[0]?.suggestedPatch).toContain("---");
    expect(result.corrections[0]?.suggestedPatch).toContain("+++");
  });
});

// ── Shadow gate — NOT_WIRED path ─────────────────────────────────────────────

describe("pairGenome — Shadow gate (NOT_WIRED)", () => {
  it("correction has promotable:false when verifyCorrection dep is not provided", async () => {
    const result = await pairGenome(MODULE_ID);
    expect(result.corrections[0]?.promotable).toBe(false);
  });

  it("correction has no proof when verifyCorrection dep is not provided", async () => {
    const result = await pairGenome(MODULE_ID);
    expect(result.corrections[0]?.proof).toBeUndefined();
  });

  it("does not throw when verifyCorrection dep is absent — returns unverified proposals", async () => {
    await expect(pairGenome(MODULE_ID)).resolves.toBeDefined();
  });
});

// ── Shadow gate — wired path ──────────────────────────────────────────────────

describe("pairGenome — Shadow gate (wired verifyCorrection)", () => {
  it("calls verifyCorrection for each correction when wired", async () => {
    const mockVerify = vi.fn().mockResolvedValue(makeProof("promote"));
    await pairGenome(MODULE_ID, { verifyCorrection: mockVerify });
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it("passes the full CorrectionProposal to verifyCorrection", async () => {
    const mockVerify = vi.fn().mockResolvedValue(makeProof("promote"));
    await pairGenome(MODULE_ID, { verifyCorrection: mockVerify });
    const calledWith = mockVerify.mock.calls[0]?.[0] as CorrectionProposal;
    expect(calledWith.invariantId).toBe("inv-2");
    expect(calledWith.invariantRule).toContain("approval");
    expect(calledWith.invariantCompliance).toBe(true);
    expect(calledWith.suggestedPatch).toContain("+++");
  });

  it("sets promotable:true when verifyCorrection returns a promote verdict", async () => {
    const mockVerify = vi.fn().mockResolvedValue(makeProof("promote"));
    const result = await pairGenome(MODULE_ID, { verifyCorrection: mockVerify });
    expect(result.corrections[0]?.promotable).toBe(true);
  });

  it("attaches the shadow proof to the correction on promote", async () => {
    const proof = makeProof("promote");
    const mockVerify = vi.fn().mockResolvedValue(proof);
    const result = await pairGenome(MODULE_ID, { verifyCorrection: mockVerify });
    expect(result.corrections[0]?.proof?.proofId).toBe(proof.proofId);
    expect(result.corrections[0]?.proof?.verdict).toBe("promote");
  });

  it("sets promotable:false when verifyCorrection returns a reject verdict", async () => {
    const mockVerify = vi.fn().mockResolvedValue(makeProof("reject"));
    const result = await pairGenome(MODULE_ID, { verifyCorrection: mockVerify });
    expect(result.corrections[0]?.promotable).toBe(false);
  });

  it("attaches the reject proof to the correction so operator can inspect", async () => {
    const proof = makeProof("reject");
    const mockVerify = vi.fn().mockResolvedValue(proof);
    const result = await pairGenome(MODULE_ID, { verifyCorrection: mockVerify });
    expect(result.corrections[0]?.proof?.verdict).toBe("reject");
  });

  it("marks correction promotable:false when verifyCorrection throws — does not propagate", async () => {
    const mockVerify = vi.fn().mockRejectedValue(new Error("Shadow container not running"));
    const result = await pairGenome(MODULE_ID, { verifyCorrection: mockVerify });
    expect(result.corrections[0]?.promotable).toBe(false);
    expect(result.corrections[0]?.proof).toBeUndefined();
  });

  it("still returns other corrections when one Shadow verification fails", async () => {
    mockGeminiAnalyze.mockResolvedValue({
      content: JSON.stringify({
        pairedInvariants: ["inv-3"],
        unpairedInvariants: [
          { id: "inv-1", type: "code-drift", evidenceRef: "No auth." },
          { id: "inv-2", type: "code-drift", evidenceRef: "No approval." },
        ],
        score: 0.33,
        rationale: "Two mismatches.",
      }),
    });
    const mockVerify = vi
      .fn()
      .mockResolvedValueOnce(makeProof("promote"))
      .mockRejectedValueOnce(new Error("Shadow timeout"));

    const result = await pairGenome(MODULE_ID, { verifyCorrection: mockVerify });
    expect(result.corrections).toHaveLength(2);
    expect(result.corrections[0]?.promotable).toBe(true);
    expect(result.corrections[1]?.promotable).toBe(false);
  });

  it("calls verifyCorrection for each mismatch, not just the first", async () => {
    mockGeminiAnalyze.mockResolvedValue({
      content: JSON.stringify({
        pairedInvariants: ["inv-3"],
        unpairedInvariants: [
          { id: "inv-1", type: "code-drift", evidenceRef: "No auth." },
          { id: "inv-2", type: "code-drift", evidenceRef: "No approval." },
        ],
        score: 0.33,
        rationale: "Two mismatches.",
      }),
    });
    const mockVerify = vi.fn().mockResolvedValue(makeProof("promote"));
    await pairGenome(MODULE_ID, { verifyCorrection: mockVerify });
    expect(mockVerify).toHaveBeenCalledTimes(2);
  });
});

// ── NOT_WIRED_VERIFY_CORRECTION standalone ────────────────────────────────────

describe("NOT_WIRED_VERIFY_CORRECTION", () => {
  const proposal: CorrectionProposal = {
    invariantId: "inv-2",
    invariantRule: "All high-value operations require explicit approval.",
    invariantCompliance: true,
    explanation: "Missing approval gate.",
    suggestedPatch: SUGGESTED_PATCH,
    requiresShadowVerification: true,
  };

  it("throws ValidationError when called", async () => {
    await expect(NOT_WIRED_VERIFY_CORRECTION(proposal)).rejects.toBeInstanceOf(ValidationError);
  });

  it("error message references verifyEquivalence and the Shadow invariant", async () => {
    const err = await NOT_WIRED_VERIFY_CORRECTION(proposal).catch((e: unknown) => e);
    expect((err as ValidationError).message).toMatch(/NOT_WIRED/);
    expect((err as ValidationError).message).toMatch(/verifyEquivalence/);
    expect((err as ValidationError).message).toMatch(/shadow_proof/i);
  });

  it("return type is ShadowProof — satisfies the required dep signature", () => {
    type ExpectedReturnType = Promise<import("@helix/shared").ShadowProof>;
    type ActualReturnType = ReturnType<typeof NOT_WIRED_VERIFY_CORRECTION>;
    const check: ActualReturnType extends ExpectedReturnType ? true : false = true;
    expect(check).toBe(true);
  });
});

// ── inferVulnClassFromInvariant ───────────────────────────────────────────────

describe("inferVulnClassFromInvariant", () => {
  it("infers SQLi for SQL/query invariants", () => {
    expect(inferVulnClassFromInvariant("SQL queries must use parameterized inputs.", false)).toBe("SQLi");
    expect(inferVulnClassFromInvariant("Never inject user input into SQL strings.", false)).toBe("SQLi");
  });

  it("infers XSS for script/HTML/escape invariants", () => {
    expect(inferVulnClassFromInvariant("User content must be HTML-escaped before rendering.", false)).toBe("XSS");
    expect(inferVulnClassFromInvariant("Never use dangerouslySetInnerHTML with user data.", false)).toBe("XSS");
  });

  it("infers missingRLS for row-level security invariants", () => {
    expect(inferVulnClassFromInvariant("Order data must be scoped via RLS to the requesting user.", false)).toBe("missingRLS");
    expect(inferVulnClassFromInvariant("Apply row level security policy on all tables.", false)).toBe("missingRLS");
  });

  it("infers secretLeak for service key / credential invariants", () => {
    expect(inferVulnClassFromInvariant("The service_role key must never be exposed client-side.", false)).toBe("secretLeak");
    expect(inferVulnClassFromInvariant("API key must not appear in browser bundles.", false)).toBe("secretLeak");
  });

  it("infers authBypass for compliance/authorization invariants (the demo case)", () => {
    expect(inferVulnClassFromInvariant("All high-value operations require explicit approval.", true)).toBe("authBypass");
    expect(inferVulnClassFromInvariant("Unauthenticated requests must be rejected with 401.", false)).toBe("authBypass");
  });
});

// ── parsePatchFilePath ────────────────────────────────────────────────────────

describe("parsePatchFilePath", () => {
  it("extracts path from +++ b/ header", () => {
    expect(parsePatchFilePath(SUGGESTED_PATCH)).toBe("apps/target/src/app/admin/orders/page.tsx");
  });

  it("extracts path from --- a/ header when no +++ present", () => {
    const diff = "--- a/apps/target/src/foo.ts\n@@ -1 +1 @@\n+fix";
    expect(parsePatchFilePath(diff)).toBe("apps/target/src/foo.ts");
  });

  it("returns null when no diff header is present", () => {
    expect(parsePatchFilePath("just some text with no diff headers")).toBeNull();
  });
});

// ── Persistence ───────────────────────────────────────────────────────────────

describe("pairGenome — pairing persistence", () => {
  it("calls updateIntentStrand to persist the new pairing score", async () => {
    await pairGenome(MODULE_ID);
    expect(mockUpdateIntentStrand).toHaveBeenCalledTimes(1);
    const [id, update] = mockUpdateIntentStrand.mock.calls[0] as [string, Partial<IntentStrand>];
    expect(id).toBe("strand-001");
    expect(update.pairing?.score).toBeCloseTo(0.67);
  });

  it("persists unpairedInvariants as invariant IDs", async () => {
    await pairGenome(MODULE_ID);
    const [, update] = mockUpdateIntentStrand.mock.calls[0] as [string, Partial<IntentStrand>];
    expect(update.pairing?.unpairedInvariants).toEqual(["inv-2"]);
  });

  it("returned strand reflects the updated pairing score", async () => {
    const result = await pairGenome(MODULE_ID);
    expect(result.strand.pairing.score).toBeCloseTo(0.67);
    expect(result.strand.pairing.unpairedInvariants).toEqual(["inv-2"]);
  });

  it("falls back to original strand when updateIntentStrand returns null", async () => {
    mockUpdateIntentStrand.mockResolvedValue(null);
    const result = await pairGenome(MODULE_ID);
    expect(result.strand.pairing.score).toBeCloseTo(0.67);
  });
});

// ── Injectable deps ───────────────────────────────────────────────────────────

describe("pairGenome — injectable analyze + explain deps", () => {
  it("uses injected analyze dep instead of Gemini", async () => {
    const mockAnalyze = vi.fn().mockResolvedValue({
      pairedInvariants: ["inv-1", "inv-2", "inv-3"],
      unpairedInvariants: [],
      score: 1.0,
      rationale: "Custom analysis.",
    });
    await pairGenome(MODULE_ID, { analyze: mockAnalyze });
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(mockGeminiAnalyze).not.toHaveBeenCalled();
  });

  it("uses injected explain dep instead of Sarvam", async () => {
    const mockExplain = vi.fn().mockResolvedValue({
      explanation: "Custom explanation.",
      suggestedPatch: SUGGESTED_PATCH,
    });
    await pairGenome(MODULE_ID, { explain: mockExplain });
    expect(mockExplain).toHaveBeenCalledTimes(1);
    expect(mockSarvamChat).not.toHaveBeenCalled();
  });

  it("does not produce corrections when no mismatches exist", async () => {
    mockGeminiAnalyze.mockResolvedValue({
      content: JSON.stringify({
        pairedInvariants: ["inv-1", "inv-2", "inv-3"],
        unpairedInvariants: [],
        score: 1.0,
        rationale: "All paired.",
      }),
    });
    const result = await pairGenome(MODULE_ID);
    expect(result.corrections).toHaveLength(0);
    expect(mockSarvamChat).not.toHaveBeenCalled();
  });
});

// ── Error cases ───────────────────────────────────────────────────────────────

describe("pairGenome — error cases", () => {
  it("throws ValidationError when no strand exists for moduleId", async () => {
    mockListIntentStrands.mockResolvedValue([]);
    const err = await pairGenome(MODULE_ID).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toMatch(/no intent strand found/i);
  });

  it("throws ValidationError when the module file does not exist on disk", async () => {
    mockExistsSync.mockReturnValue(false);
    const err = await pairGenome(MODULE_ID).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toMatch(/file not found/i);
  });

  it("propagates Gemini errors to the caller", async () => {
    mockGeminiAnalyze.mockRejectedValue(new Error("Gemini timeout"));
    const err = await pairGenome(MODULE_ID).catch((e: unknown) => e);
    expect((err as Error).message).toContain("Gemini timeout");
  });

  it("propagates Sarvam errors to the caller", async () => {
    mockSarvamChat.mockRejectedValue(new Error("Sarvam 429"));
    const err = await pairGenome(MODULE_ID).catch((e: unknown) => e);
    expect((err as Error).message).toContain("Sarvam 429");
  });

  it("throws when Gemini returns malformed JSON", async () => {
    mockGeminiAnalyze.mockResolvedValue({ content: "not-json" });
    await expect(pairGenome(MODULE_ID)).rejects.toThrow();
  });

  it("throws when Gemini JSON fails schema validation", async () => {
    mockGeminiAnalyze.mockResolvedValue({
      content: JSON.stringify({ pairedInvariants: ["inv-1"], score: "high" }),
    });
    await expect(pairGenome(MODULE_ID)).rejects.toThrow();
  });
});

// ── Demo scenario — silent approval step drop ────────────────────────────────

describe("pairGenome — demo: silent approval-step drop (admin/orders)", () => {
  it("flags inv-2 (compliance:true) as code-drift when approval step is absent", async () => {
    const result = await pairGenome(MODULE_ID);
    const mismatch = result.mismatches.find((m) => m.invariantId === "inv-2");
    expect(mismatch).toBeDefined();
    expect(mismatch?.type).toBe("code-drift");
  });

  it("correction for inv-2 has promotable:false without Shadow wiring", async () => {
    const result = await pairGenome(MODULE_ID);
    const correction = result.corrections.find((c) => c.invariantId === "inv-2");
    expect(correction?.promotable).toBe(false);
    expect(correction?.requiresShadowVerification).toBe(true);
  });

  it("correction for inv-2 becomes promotable when Shadow returns verdict:promote", async () => {
    const proof = makeProof("promote");
    const result = await pairGenome(MODULE_ID, {
      verifyCorrection: vi.fn().mockResolvedValue(proof),
    });
    const correction = result.corrections.find((c) => c.invariantId === "inv-2");
    expect(correction?.promotable).toBe(true);
    expect(correction?.proof?.verdict).toBe("promote");
  });

  it("score is below 1.0 when compliance invariant is unpaired", async () => {
    const result = await pairGenome(MODULE_ID);
    expect(result.score).toBeLessThan(1.0);
  });

  it("correction carries both invariantRule and invariantCompliance for Shadow routing", async () => {
    const result = await pairGenome(MODULE_ID);
    const correction = result.corrections.find((c) => c.invariantId === "inv-2");
    expect(correction?.invariantCompliance).toBe(true);
    expect(correction?.invariantRule).toBeTruthy();
  });
});
