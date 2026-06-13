import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Antibody } from "@helix/shared";
import type { HelixDoc } from "@helix/db";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAntibody(overrides: Partial<HelixDoc<Antibody>> = {}): HelixDoc<Antibody> {
  return {
    _id: "ab-mongo-001",
    antibodyId: "ab-sqli-api-products-search",
    sourceType: "vuln",
    signature: "a1b2c3d4e5f60000",
    embedding: Array.from({ length: 1536 }, (_, i) => i === 0 ? 1.0 : 0.0),
    regressionTest: "import { describe, it, expect } from 'vitest'; describe('ab', () => { it('ok', () => {}); });",
    runtimeAssertion: "Use parameterized queries.",
    mintedAt: "2026-01-01T00:00:00.000Z",
    recurrencesBlocked: 0,
    ...overrides,
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAntibody = makeAntibody();

vi.mock("@helix/db", () => ({
  connectDb: vi.fn().mockResolvedValue(undefined),
  listAntibodies: vi.fn(async () => [mockAntibody]),
  updateAntibody: vi.fn().mockResolvedValue(null),
  AntibodyModel: {
    aggregate: vi.fn().mockRejectedValue(new Error("Atlas not available")),
  },
}));

vi.mock("@helix/ai", () => ({
  embed: vi.fn().mockResolvedValue(
    // Identical to mockAntibody.embedding — cosine score should be 1.0
    Array.from({ length: 1536 }, (_, i) => i === 0 ? 1.0 : 0.0),
  ),
}));

// Prevent vitest from actually spawning child processes
vi.mock("child_process", () => ({
  spawnSync: vi.fn().mockReturnValue({ status: 0, stdout: "", stderr: "" }),
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    readdirSync: vi.fn().mockReturnValue(["ab-sqli-api-products-search.test.ts"]),
  };
});

import { matchAntibody, blockRecurrence } from "../memory/recall.js";
import { embed } from "@helix/ai";
import { AntibodyModel, listAntibodies, updateAntibody } from "@helix/db";
import { spawnSync } from "child_process";

beforeEach(() => {
  vi.mocked(embed).mockClear();
  vi.mocked(listAntibodies).mockClear();
  vi.mocked(updateAntibody).mockClear();
  vi.mocked(spawnSync).mockClear();
  // Default: Atlas unavailable
  vi.mocked(AntibodyModel.aggregate).mockRejectedValue(new Error("Atlas not available"));
});

// ── matchAntibody — exact signature ──────────────────────────────────────────

describe("matchAntibody — exact signature string", () => {
  it("returns score 1.0 with matchType=exact when signature found", async () => {
    vi.mocked(listAntibodies).mockResolvedValueOnce([mockAntibody]);

    const results = await matchAntibody("a1b2c3d4e5f60000");

    expect(results).toHaveLength(1);
    expect(results[0]!.score).toBe(1.0);
    expect(results[0]!.matchType).toBe("exact");
    expect(results[0]!.antibody.antibodyId).toBe("ab-sqli-api-products-search");
    // Should NOT call embed for exact signature
    expect(embed).not.toHaveBeenCalled();
  });

  it("falls through to vector search if signature not found", async () => {
    // First call (exact): returns [] — antibody with different signature
    vi.mocked(listAntibodies)
      .mockResolvedValueOnce([]) // exact lookup: not found
      .mockResolvedValueOnce([mockAntibody]); // cosine fallback: all antibodies

    const results = await matchAntibody("0000000000000000");

    expect(embed).toHaveBeenCalledOnce();
    expect(results.length).toBeGreaterThan(0);
  });
});

// ── matchAntibody — string embedding ─────────────────────────────────────────

describe("matchAntibody — arbitrary string", () => {
  it("embeds the string and returns cosine-fallback results when Atlas unavailable", async () => {
    vi.mocked(listAntibodies).mockResolvedValueOnce([mockAntibody]);

    const results = await matchAntibody("SQL injection in product search");

    expect(embed).toHaveBeenCalledOnce();
    expect(embed).toHaveBeenCalledWith("SQL injection in product search");
    expect(results[0]!.matchType).toBe("vector-cosine");
    expect(results[0]!.score).toBeCloseTo(1.0, 2); // same vector → cosine = 1
  });

  it("returns Atlas results when $vectorSearch succeeds", async () => {
    const atlasResult = {
      _id: "ab-mongo-001",
      antibodyId: "ab-sqli-api-products-search",
      sourceType: "vuln",
      signature: "a1b2c3d4e5f60000",
      embedding: Array.from({ length: 1536 }, (_, i) => i === 0 ? 1.0 : 0.0),
      regressionTest: "test",
      runtimeAssertion: "rule",
      mintedAt: "2026-01-01T00:00:00.000Z",
      recurrencesBlocked: 0,
      score: 0.98,
    };
    vi.mocked(AntibodyModel.aggregate).mockResolvedValueOnce([atlasResult]);

    const results = await matchAntibody("SQL injection");

    expect(results[0]!.matchType).toBe("vector-atlas");
    expect(results[0]!.score).toBeCloseTo(0.98, 2);
  });

  it("respects the limit parameter", async () => {
    const three = [
      makeAntibody({ _id: "1", antibodyId: "ab-a" }),
      makeAntibody({ _id: "2", antibodyId: "ab-b" }),
      makeAntibody({ _id: "3", antibodyId: "ab-c" }),
    ];
    vi.mocked(listAntibodies).mockResolvedValueOnce(three);

    const results = await matchAntibody("some vuln", 2);

    expect(results).toHaveLength(2);
  });
});

// ── matchAntibody — number[] embedding ────────────────────────────────────────

describe("matchAntibody — pre-computed number[] embedding", () => {
  it("skips embedding step and goes straight to vector search", async () => {
    vi.mocked(listAntibodies).mockResolvedValueOnce([mockAntibody]);

    const queryVector = Array.from({ length: 1536 }, (_, i) => i === 0 ? 1.0 : 0.0);
    const results = await matchAntibody(queryVector);

    expect(embed).not.toHaveBeenCalled();
    expect(results[0]!.score).toBeCloseTo(1.0, 2);
  });

  it("throws ValidationError on empty array input", async () => {
    const { ValidationError } = await import("@helix/shared");
    await expect(matchAntibody([])).rejects.toThrow(ValidationError);
  });
});

// ── blockRecurrence — all passing ─────────────────────────────────────────────

describe("blockRecurrence — all tests pass", () => {
  it("returns passed=1, failed=0, recurrences=[] when test exits 0", async () => {
    vi.mocked(spawnSync).mockReturnValueOnce({ status: 0, stdout: "PASS", stderr: "" } as ReturnType<typeof spawnSync>);

    const report = await blockRecurrence({ targetUrl: "http://localhost:3001" });

    expect(report.total).toBe(1);
    expect(report.passed).toBe(1);
    expect(report.failed).toBe(0);
    expect(report.recurrences).toHaveLength(0);
  });

  it("passes TARGET_URL to the spawned vitest process", async () => {
    vi.mocked(spawnSync).mockReturnValueOnce({ status: 0, stdout: "", stderr: "" } as ReturnType<typeof spawnSync>);

    await blockRecurrence({ targetUrl: "http://custom-target:3001" });

    const call = vi.mocked(spawnSync).mock.calls[0]!;
    const env = call[2] as { env?: Record<string, string> };
    expect(env.env?.["TARGET_URL"]).toBe("http://custom-target:3001");
  });
});

// ── blockRecurrence — test failure = recurrence ───────────────────────────────

describe("blockRecurrence — test failure detected", () => {
  it("returns failed=1 and reports the recurrence", async () => {
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 1,
      stdout: "FAIL: tautology returned all rows",
      stderr: "",
    } as ReturnType<typeof spawnSync>);

    vi.mocked(listAntibodies).mockResolvedValue([mockAntibody]);

    const report = await blockRecurrence();

    expect(report.failed).toBe(1);
    expect(report.recurrences[0]!.antibodyId).toBe("ab-sqli-api-products-search");
    expect(report.recurrences[0]!.detail).toContain("tautology");
  });

  it("increments recurrencesBlocked on the affected antibody", async () => {
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 1,
      stdout: "FAIL",
      stderr: "",
    } as ReturnType<typeof spawnSync>);

    vi.mocked(listAntibodies).mockResolvedValue([mockAntibody]);

    await blockRecurrence();

    expect(updateAntibody).toHaveBeenCalledWith("ab-mongo-001", {
      recurrencesBlocked: 1,
    });
  });
});

// ── blockRecurrence — no test directory ───────────────────────────────────────

describe("blockRecurrence — no antibody tests yet", () => {
  it("returns zero totals when test directory does not exist", async () => {
    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValueOnce(false);

    const report = await blockRecurrence();

    expect(report.total).toBe(0);
    expect(report.passed).toBe(0);
    expect(report.failed).toBe(0);
    expect(spawnSync).not.toHaveBeenCalled();
  });
});
