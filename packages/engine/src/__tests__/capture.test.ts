import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "@helix/shared";
import type { IntentStrand } from "@helix/shared";
import type { HelixDoc } from "@helix/db";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const {
  mockConnectDb,
  mockCreateIntentStrand,
  mockUpdateIntentStrand,
  mockListIntentStrands,
  mockSarvamChat,
  mockReadFileSync,
  mockExistsSync,
} = vi.hoisted(() => ({
  mockConnectDb: vi.fn().mockResolvedValue(undefined),
  mockCreateIntentStrand: vi.fn(),
  mockUpdateIntentStrand: vi.fn(),
  mockListIntentStrands: vi.fn(),
  mockSarvamChat: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
}));

vi.mock("@helix/db", () => ({
  connectDb: mockConnectDb,
  createIntentStrand: mockCreateIntentStrand,
  updateIntentStrand: mockUpdateIntentStrand,
  listIntentStrands: mockListIntentStrands,
}));

vi.mock("@helix/ai", () => ({
  sarvam: { chat: mockSarvamChat },
}));

vi.mock("fs", () => ({
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
}));

import { captureIntent, SHOPLITE_MODULES } from "../genome/capture.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MODULE_PATH = "apps/target/src/app/api/products/search/route.ts";
const MOCK_SOURCE = `export async function GET(req: Request) { /* SQLi vuln */ }`;

function makeSarvamOutput() {
  return JSON.stringify({
    purpose: "Provides product search functionality via GET endpoint.",
    invariants: [
      { id: "inv-1", rule: "SQL queries must use parameterized inputs.", rationale: "Prevents SQL injection.", compliance: false },
      { id: "inv-2", rule: "User input must never be concatenated into SQL strings.", rationale: "SQL injection vulnerability class.", compliance: false },
      { id: "inv-3", rule: "All database access must use the authenticated Supabase client.", rationale: "Unauthorized access prevention.", compliance: true },
    ],
    edgeDecisions: [
      "Falls back to mock product data when Supabase is not configured.",
      "Returns raw SQL string in debug response for development tracing.",
    ],
  });
}

function makeStrand(overrides: Partial<IntentStrand> = {}): HelixDoc<IntentStrand> {
  return {
    _id: "strand-mongo-001",
    moduleId: MODULE_PATH,
    purpose: "Provides product search functionality via GET endpoint.",
    invariants: [
      { id: "inv-1", rule: "SQL queries must use parameterized inputs.", rationale: "Prevents SQL injection.", compliance: false },
      { id: "inv-3", rule: "All DB access via authenticated client.", rationale: "Auth requirement.", compliance: true },
    ],
    edgeDecisions: ["Falls back to mock data when Supabase unavailable."],
    sourcePrompt: "Auto-captured",
    generatedBy: { model: "sarvam-m", version: "1" },
    pairing: { score: 1.0, lastChecked: new Date().toISOString(), unpairedInvariants: [] },
    ...overrides,
  } as HelixDoc<IntentStrand>;
}

beforeEach(() => {
  mockConnectDb.mockClear();
  mockCreateIntentStrand.mockClear();
  mockUpdateIntentStrand.mockClear();
  mockListIntentStrands.mockClear();
  mockSarvamChat.mockClear();
  mockReadFileSync.mockClear();
  mockExistsSync.mockClear();

  // Default: file exists, Sarvam returns valid output, no existing strand
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue(MOCK_SOURCE);
  mockSarvamChat.mockResolvedValue({ content: makeSarvamOutput() });
  mockListIntentStrands.mockResolvedValue([]);
  mockCreateIntentStrand.mockResolvedValue(makeStrand());
  mockUpdateIntentStrand.mockResolvedValue(makeStrand());
});

// ── Happy path — create ───────────────────────────────────────────────────────

describe("captureIntent — create (first capture)", () => {
  it("calls createIntentStrand when no strand exists for moduleId", async () => {
    await captureIntent(MODULE_PATH);
    expect(mockCreateIntentStrand).toHaveBeenCalledTimes(1);
    expect(mockUpdateIntentStrand).not.toHaveBeenCalled();
  });

  it("returns the created strand", async () => {
    const result = await captureIntent(MODULE_PATH);
    expect(result._id).toBe("strand-mongo-001");
    expect(result.moduleId).toBe(MODULE_PATH);
  });

  it("persists the moduleId from the path argument", async () => {
    await captureIntent(MODULE_PATH);
    const call = mockCreateIntentStrand.mock.calls[0]?.[0] as IntentStrand;
    expect(call.moduleId).toBe(MODULE_PATH);
  });

  it("sets pairing.score to 1.0 on first capture", async () => {
    await captureIntent(MODULE_PATH);
    const call = mockCreateIntentStrand.mock.calls[0]?.[0] as IntentStrand;
    expect(call.pairing.score).toBe(1.0);
    expect(call.pairing.unpairedInvariants).toHaveLength(0);
  });

  it("sets generatedBy.model to sarvam-m", async () => {
    await captureIntent(MODULE_PATH);
    const call = mockCreateIntentStrand.mock.calls[0]?.[0] as IntentStrand;
    expect(call.generatedBy.model).toBe("sarvam-m");
  });

  it("passes context as sourcePrompt when provided", async () => {
    await captureIntent(MODULE_PATH, "PR: add search endpoint");
    const call = mockCreateIntentStrand.mock.calls[0]?.[0] as IntentStrand;
    expect(call.sourcePrompt).toContain("PR: add search endpoint");
  });

  it("reads the source file from disk", async () => {
    await captureIntent(MODULE_PATH);
    expect(mockReadFileSync).toHaveBeenCalledWith(
      expect.stringContaining(MODULE_PATH),
      "utf8",
    );
  });

  it("sends source code to Sarvam", async () => {
    await captureIntent(MODULE_PATH);
    const chatCall = mockSarvamChat.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
    const userMsg = chatCall.messages.find((m) => m.role === "user")?.content ?? "";
    expect(userMsg).toContain(MOCK_SOURCE.slice(0, 50));
  });
});

// ── Upsert path — update ──────────────────────────────────────────────────────

describe("captureIntent — update (strand already exists)", () => {
  it("calls updateIntentStrand when strand for moduleId already exists", async () => {
    mockListIntentStrands.mockResolvedValue([makeStrand()]);
    await captureIntent(MODULE_PATH);

    expect(mockUpdateIntentStrand).toHaveBeenCalledTimes(1);
    expect(mockCreateIntentStrand).not.toHaveBeenCalled();
  });

  it("updates using the existing _id and does not include moduleId in the update payload", async () => {
    mockListIntentStrands.mockResolvedValue([makeStrand()]);
    await captureIntent(MODULE_PATH);

    const updateArg = mockUpdateIntentStrand.mock.calls[0] as [string, Partial<IntentStrand>];
    expect(updateArg[0]).toBe("strand-mongo-001");
    expect(updateArg[1]).not.toHaveProperty("moduleId");
  });

  it("preserves pairing score from existing strand (not overwritten)", async () => {
    const existing = makeStrand({ pairing: { score: 0.6, lastChecked: "2026-01-01", unpairedInvariants: ["inv-2"] } });
    mockListIntentStrands.mockResolvedValue([existing]);
    await captureIntent(MODULE_PATH);

    const updateCall = mockUpdateIntentStrand.mock.calls[0]?.[1] as Partial<IntentStrand>;
    expect(updateCall.pairing).toBeUndefined();
  });

  it("returns the updated strand", async () => {
    mockListIntentStrands.mockResolvedValue([makeStrand()]);
    const result = await captureIntent(MODULE_PATH);
    expect(result._id).toBe("strand-mongo-001");
  });
});

// ── Sarvam validation ─────────────────────────────────────────────────────────

describe("captureIntent — Sarvam output validation", () => {
  it("extracts invariants from Sarvam response", async () => {
    await captureIntent(MODULE_PATH);
    const call = mockCreateIntentStrand.mock.calls[0]?.[0] as IntentStrand;
    expect(call.invariants.length).toBeGreaterThanOrEqual(2);
  });

  it("extracts edgeDecisions from Sarvam response", async () => {
    await captureIntent(MODULE_PATH);
    const call = mockCreateIntentStrand.mock.calls[0]?.[0] as IntentStrand;
    expect(call.edgeDecisions.length).toBeGreaterThanOrEqual(1);
  });

  it("falls back to deterministic extraction when Sarvam fails", async () => {
    mockSarvamChat.mockRejectedValue(new Error("API timeout"));
    await captureIntent(MODULE_PATH, "compliance refund approval");

    expect(mockCreateIntentStrand).toHaveBeenCalledTimes(1);
    const call = mockCreateIntentStrand.mock.calls[0]?.[0] as IntentStrand;
    expect(call.invariants.length).toBeGreaterThanOrEqual(2);
  });

  it("deterministic fallback sets compliance:true when context mentions compliance", async () => {
    mockSarvamChat.mockRejectedValue(new Error("timeout"));
    await captureIntent(MODULE_PATH, "COMPLIANCE: refund approval required");

    const call = mockCreateIntentStrand.mock.calls[0]?.[0] as IntentStrand;
    const hasCompliance = call.invariants.some((i) => i.compliance === true);
    expect(hasCompliance).toBe(true);
  });
});

// ── File not found ────────────────────────────────────────────────────────────

describe("captureIntent — file validation", () => {
  it("throws ValidationError when module file does not exist", async () => {
    mockExistsSync.mockReturnValue(false);
    const err = await captureIntent("nonexistent/file.ts").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toMatch(/not found/i);
  });

  it("does not call Sarvam when file does not exist", async () => {
    mockExistsSync.mockReturnValue(false);
    await captureIntent("nonexistent/file.ts").catch(() => null);
    expect(mockSarvamChat).not.toHaveBeenCalled();
  });
});

// ── SHOPLITE_MODULES seed data ────────────────────────────────────────────────

describe("SHOPLITE_MODULES", () => {
  it("has 5 entries", () => {
    expect(SHOPLITE_MODULES).toHaveLength(5);
  });

  it("includes the admin/orders module with compliance context", () => {
    const orders = SHOPLITE_MODULES.find((m) => m.path.includes("admin/orders"));
    expect(orders).toBeDefined();
    expect(orders?.context).toMatch(/refund/i);
    expect(orders?.context).toMatch(/compliance/i);
    expect(orders?.context).toMatch(/approval/i);
  });

  it("includes the search route module", () => {
    const search = SHOPLITE_MODULES.find((m) => m.path.includes("products/search"));
    expect(search).toBeDefined();
  });

  it("all module paths start with apps/target/", () => {
    for (const mod of SHOPLITE_MODULES) {
      expect(mod.path).toMatch(/^apps\/target\//);
    }
  });
});
