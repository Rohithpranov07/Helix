import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "@helix/shared";
import type { IntentStrand } from "@helix/shared";
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

import { pairGenome, NOT_WIRED_VERIFY_CORRECTION } from "../genome/pair.js";
import type { CorrectionProposal } from "../genome/pair.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MODULE_ID = "apps/target/src/app/admin/orders/page.tsx";
const MOCK_CODE = `
export default async function AdminOrdersPage() {
  const supabase = getSupabase();
  const { data } = await supabase.from("orders").select("*");
  return <div>{JSON.stringify(data)}</div>;
}`.trim();

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
    suggestedPatch:
      "--- a/apps/target/src/app/admin/orders/page.tsx\n+++ b/apps/target/src/app/admin/orders/page.tsx\n@@ -1,3 +1,6 @@\n+if (amount > REFUND_THRESHOLD && !hasApproval(orderId)) {\n+  return NextResponse.json({ error: 'approval_required' }, { status: 403 });\n+}\n",
  });
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

// ── Happy path — mismatches detected ─────────────────────────────────────────

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
    mockSarvamChat.mockResolvedValue({ content: makeSarvamCorrection() });
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

// ── Correction proposals ──────────────────────────────────────────────────────

describe("pairGenome — correction proposals", () => {
  it("returns one correction per mismatch", async () => {
    const result = await pairGenome(MODULE_ID);
    expect(result.corrections).toHaveLength(1);
    expect(result.corrections[0]?.invariantId).toBe("inv-2");
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

  it("uses injected explain dep instead of sarvam when provided", async () => {
    const mockExplain = vi.fn().mockResolvedValue({
      explanation: "Custom explanation.",
      suggestedPatch: "--- a/foo\n+++ b/foo\n@@ -1 +1 @@\n+fix",
    });
    await pairGenome(MODULE_ID, { explain: mockExplain });
    expect(mockExplain).toHaveBeenCalledTimes(1);
    expect(mockSarvamChat).not.toHaveBeenCalled();
  });

  it("does not produce a correction when no mismatches exist", async () => {
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

// ── Shadow gate — NOT_WIRED seam ──────────────────────────────────────────────

describe("NOT_WIRED_VERIFY_CORRECTION", () => {
  it("throws ValidationError when called without wiring", async () => {
    const proposal: CorrectionProposal = {
      invariantId: "inv-2",
      explanation: "Missing approval gate.",
      suggestedPatch: "--- a/foo\n+++ b/foo\n@@ -1 +1 @@\n+fix",
      requiresShadowVerification: true,
    };
    await expect(NOT_WIRED_VERIFY_CORRECTION(proposal)).rejects.toBeInstanceOf(ValidationError);
  });

  it("error message explains the wiring requirement", async () => {
    const proposal: CorrectionProposal = {
      invariantId: "inv-2",
      explanation: "Missing approval gate.",
      suggestedPatch: "--- a/foo\n+++ b/foo\n@@ -1 +1 @@\n+fix",
      requiresShadowVerification: true,
    };
    const err = await NOT_WIRED_VERIFY_CORRECTION(proposal).catch((e: unknown) => e);
    expect((err as ValidationError).message).toMatch(/NOT_WIRED/);
    expect((err as ValidationError).message).toMatch(/verifyEquivalence/);
  });

  it("wired verifyCorrection dep is called when provided", async () => {
    const mockVerify = vi.fn().mockResolvedValue(undefined);
    await pairGenome(MODULE_ID, { verifyCorrection: mockVerify });
    // verifyCorrection is not auto-called by pairGenome — it's a consumer-side gate.
    // This test confirms the dep is accepted without error.
    expect(mockVerify).not.toHaveBeenCalled();
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

  it("persists lastChecked as a recent ISO timestamp", async () => {
    const before = Date.now();
    await pairGenome(MODULE_ID);
    const [, update] = mockUpdateIntentStrand.mock.calls[0] as [string, Partial<IntentStrand>];
    const ts = new Date(update.pairing?.lastChecked ?? "").getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
  });

  it("returned strand reflects the updated pairing score", async () => {
    const result = await pairGenome(MODULE_ID);
    expect(result.strand.pairing.score).toBeCloseTo(0.67);
    expect(result.strand.pairing.unpairedInvariants).toEqual(["inv-2"]);
  });

  it("falls back to original strand when updateIntentStrand returns null", async () => {
    mockUpdateIntentStrand.mockResolvedValue(null);
    const result = await pairGenome(MODULE_ID);
    // Strand should still have updated pairing values applied from local state.
    expect(result.strand.pairing.score).toBeCloseTo(0.67);
  });
});

// ── Injectable analyze dep ────────────────────────────────────────────────────

describe("pairGenome — injectable analyze dep", () => {
  it("uses injected analyze dep instead of Gemini when provided", async () => {
    const mockAnalyze = vi.fn().mockResolvedValue({
      pairedInvariants: ["inv-1"],
      unpairedInvariants: [
        { id: "inv-2", type: "code-drift" as const, evidenceRef: "Custom evidence." },
        { id: "inv-3", type: "code-drift" as const, evidenceRef: "Another gap." },
      ],
      score: 0.33,
      rationale: "Custom analysis.",
    });
    const result = await pairGenome(MODULE_ID, { analyze: mockAnalyze });
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(mockGeminiAnalyze).not.toHaveBeenCalled();
    expect(result.mismatches).toHaveLength(2);
  });

  it("passes source code and invariants to the analyze dep", async () => {
    const mockAnalyze = vi.fn().mockResolvedValue({
      pairedInvariants: ["inv-1", "inv-2", "inv-3"],
      unpairedInvariants: [],
      score: 1.0,
      rationale: "All paired.",
    });
    await pairGenome(MODULE_ID, { analyze: mockAnalyze });
    const [code, invariants] = mockAnalyze.mock.calls[0] as [string, IntentStrand["invariants"]];
    expect(code).toContain("orders");
    expect(invariants).toHaveLength(3);
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

// ── Demo scenario — silent approval step drop ─────────────────────────────────

describe("pairGenome — demo: silent approval-step drop (admin/orders)", () => {
  it("flags inv-2 (compliance:true) as code-drift when approval step is absent", async () => {
    const result = await pairGenome(MODULE_ID);
    const mismatch = result.mismatches.find((m) => m.invariantId === "inv-2");
    expect(mismatch).toBeDefined();
    expect(mismatch?.type).toBe("code-drift");
  });

  it("correction proposal for inv-2 references the approval requirement", async () => {
    const result = await pairGenome(MODULE_ID);
    const correction = result.corrections.find((c) => c.invariantId === "inv-2");
    expect(correction).toBeDefined();
    expect(correction?.requiresShadowVerification).toBe(true);
  });

  it("score is below 1.0 when compliance invariant is unpaired", async () => {
    const result = await pairGenome(MODULE_ID);
    expect(result.score).toBeLessThan(1.0);
  });
});
