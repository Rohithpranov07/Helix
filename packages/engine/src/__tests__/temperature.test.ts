import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "@helix/shared";
import type { EntropyPoint } from "@helix/shared";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const {
  mockConnectDb,
  mockCreateEntropyPoint,
  mockListEntropyPoints,
} = vi.hoisted(() => ({
  mockConnectDb: vi.fn().mockResolvedValue(undefined),
  mockCreateEntropyPoint: vi.fn(),
  mockListEntropyPoints: vi.fn(),
}));

vi.mock("@helix/db", () => ({
  connectDb: mockConnectDb,
  createEntropyPoint: mockCreateEntropyPoint,
  listEntropyPoints: mockListEntropyPoints,
}));

// ai and fs mocked only where needed — we use injectable deps for most tests.
vi.mock("@helix/ai", () => ({
  gemini: { analyze: vi.fn() },
}));

import {
  measureEntropy,
  computeTemperature,
  computeProjectedWeeks,
} from "../metabolism/temperature.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_SOURCES = `
// FILE: apps/target/src/app/api/products/search/route.ts
// HELIX-DEMO-VULN: SQLi
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q");
  const result = await db.query("SELECT * FROM products WHERE name = '" + q + "'");
  return Response.json(result);
}

// FILE: apps/target/src/app/search/page.tsx
export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  return <div dangerouslySetInnerHTML={{ __html: searchParams.q ?? "" }} />;
}
`.trim();

function makeDims(overrides: Partial<Record<string, number>> = {}) {
  return {
    duplication: 0.1,
    patternVariance: 0.2,
    coupling: 0.3,
    vulnDensity: 0.8,
    comprehension: 0.2,
    rationale: "Mock analysis",
    ...overrides,
  };
}

function makeStoredPoint(temp: number, ts = new Date().toISOString()) {
  return {
    _id: `pt-${Math.random().toString(36).slice(2, 8)}`,
    ts,
    temperature: temp,
    dims: { duplication: 0.1, patternVariance: 0.1, coupling: 0.1, vulnDensity: temp, comprehension: 0.1 },
    projectedRewriteWeeks: Math.round((1 - temp) * 50),
  };
}

function makeHelixDoc(point: EntropyPoint) {
  return { _id: "doc-001", ...point };
}

beforeEach(() => {
  mockConnectDb.mockClear();
  mockCreateEntropyPoint.mockClear();
  mockListEntropyPoints.mockClear();

  mockListEntropyPoints.mockResolvedValue([]);
  mockCreateEntropyPoint.mockImplementation((p: EntropyPoint) =>
    Promise.resolve(makeHelixDoc(p)),
  );
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("measureEntropy — happy path", () => {
  it("returns a valid EntropyPoint with all required fields", async () => {
    const result = await measureEntropy(".", {
      collectSources: () => MOCK_SOURCES,
      analyze: async () => makeDims(),
    });
    expect(result.ts).toBeTruthy();
    expect(typeof result.temperature).toBe("number");
    expect(result.dims).toMatchObject({
      duplication: expect.any(Number),
      patternVariance: expect.any(Number),
      coupling: expect.any(Number),
      vulnDensity: expect.any(Number),
      comprehension: expect.any(Number),
    });
    expect(typeof result.projectedRewriteWeeks).toBe("number");
  });

  it("persists the EntropyPoint to the DB via createEntropyPoint", async () => {
    await measureEntropy(".", {
      collectSources: () => MOCK_SOURCES,
      analyze: async () => makeDims(),
    });
    expect(mockCreateEntropyPoint).toHaveBeenCalledTimes(1);
    const stored = mockCreateEntropyPoint.mock.calls[0]?.[0] as EntropyPoint;
    expect(stored.temperature).toBeGreaterThan(0);
    expect(stored.dims.vulnDensity).toBe(0.8);
  });

  it("sets ts as a recent ISO timestamp", async () => {
    const before = Date.now();
    await measureEntropy(".", {
      collectSources: () => MOCK_SOURCES,
      analyze: async () => makeDims(),
    });
    const stored = mockCreateEntropyPoint.mock.calls[0]?.[0] as EntropyPoint;
    const ts = new Date(stored.ts).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
  });

  it("calls listHistory to fetch trajectory data", async () => {
    const mockHistory = vi.fn().mockResolvedValue([]);
    await measureEntropy(".", {
      collectSources: () => MOCK_SOURCES,
      analyze: async () => makeDims(),
      listHistory: mockHistory,
    });
    expect(mockHistory).toHaveBeenCalledTimes(1);
    expect(mockHistory).toHaveBeenCalledWith(20);
  });
});

// ── computeTemperature ────────────────────────────────────────────────────────

describe("computeTemperature", () => {
  it("returns 0 when all dims are 0", () => {
    const t = computeTemperature({
      duplication: 0, patternVariance: 0, coupling: 0, vulnDensity: 0, comprehension: 0,
    });
    expect(t).toBe(0);
  });

  it("returns 1 when all dims are 1", () => {
    const t = computeTemperature({
      duplication: 1, patternVariance: 1, coupling: 1, vulnDensity: 1, comprehension: 1,
    });
    expect(t).toBe(1);
  });

  it("weights duplication and vulnDensity highest — mid score reflects them", () => {
    const tHighVuln = computeTemperature({
      duplication: 0, patternVariance: 0, coupling: 0, vulnDensity: 1, comprehension: 0,
    });
    const tHighComprehension = computeTemperature({
      duplication: 0, patternVariance: 0, coupling: 0, vulnDensity: 0, comprehension: 1,
    });
    expect(tHighVuln).toBeGreaterThan(tHighComprehension);
  });

  it("temperature rises when vulnDensity increases", () => {
    const base = computeTemperature({ duplication: 0.1, patternVariance: 0.1, coupling: 0.1, vulnDensity: 0.2, comprehension: 0.1 });
    const high = computeTemperature({ duplication: 0.1, patternVariance: 0.1, coupling: 0.1, vulnDensity: 0.8, comprehension: 0.1 });
    expect(high).toBeGreaterThan(base);
  });

  it("result is between 0 and 1 for valid dim inputs", () => {
    const t = computeTemperature({ duplication: 0.3, patternVariance: 0.4, coupling: 0.5, vulnDensity: 0.6, comprehension: 0.2 });
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(1);
  });
});

// ── computeProjectedWeeks ─────────────────────────────────────────────────────

describe("computeProjectedWeeks", () => {
  it("returns 0 when temperature is at or above the rewrite threshold (1.0)", () => {
    expect(computeProjectedWeeks(1.0, [])).toBe(0);
    expect(computeProjectedWeeks(1.1, [])).toBe(0);
  });

  it("uses DEFAULT_WEEKLY_RISE (0.02) when no history exists", () => {
    // gap = 1.0 - 0.5 = 0.5; weeks = 0.5 / 0.02 = 25
    expect(computeProjectedWeeks(0.5, [])).toBe(25);
  });

  it("uses DEFAULT_WEEKLY_RISE when only one history point exists", () => {
    const history = [{ temperature: 0.3, ts: new Date().toISOString() }];
    expect(computeProjectedWeeks(0.5, history)).toBe(25);
  });

  it("projects from trajectory when ≥2 history points exist", () => {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    // rose 0.1 in one week → rate = 0.1/week
    // current temp = 0.5, gap to 1.0 = 0.5, weeks = 0.5/0.1 = 5
    const history = [
      { temperature: 0.5, ts: new Date(now).toISOString() },
      { temperature: 0.4, ts: new Date(oneWeekAgo).toISOString() },
    ];
    expect(computeProjectedWeeks(0.5, history)).toBe(5);
  });

  it("falls back to DEFAULT_WEEKLY_RISE if temperature is not rising (slope ≤ 0)", () => {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    // Flat or declining — use default rate
    const history = [
      { temperature: 0.3, ts: new Date(now).toISOString() },
      { temperature: 0.4, ts: new Date(oneWeekAgo).toISOString() }, // higher in past → declining
    ];
    expect(computeProjectedWeeks(0.3, history)).toBe(35); // 0.7/0.02
  });

  it("projectedRewriteWeeks falls as temperature rises (the demo requirement)", () => {
    const weeks1 = computeProjectedWeeks(0.3, []);
    const weeks2 = computeProjectedWeeks(0.6, []);
    const weeks3 = computeProjectedWeeks(0.9, []);
    expect(weeks1).toBeGreaterThan(weeks2);
    expect(weeks2).toBeGreaterThan(weeks3);
  });

  it("never returns a negative value", () => {
    expect(computeProjectedWeeks(1.5, [])).toBe(0);
  });
});

// ── Temperature dim integration ───────────────────────────────────────────────

describe("measureEntropy — temperature computation from dims", () => {
  it("a ShopLite-like high-vuln repo produces temperature above 0.4", async () => {
    const result = await measureEntropy(".", {
      collectSources: () => MOCK_SOURCES,
      analyze: async () => makeDims({ vulnDensity: 0.9, coupling: 0.7, duplication: 0.5 }),
    });
    expect(result.temperature).toBeGreaterThan(0.4);
  });

  it("a clean repo produces lower temperature", async () => {
    const cleanDims = { duplication: 0.05, patternVariance: 0.1, coupling: 0.05, vulnDensity: 0.05, comprehension: 0.1 };
    const dirtyDims = { duplication: 0.5, patternVariance: 0.4, coupling: 0.5, vulnDensity: 0.8, comprehension: 0.5 };
    const clean = await measureEntropy(".", {
      collectSources: () => MOCK_SOURCES,
      analyze: async () => makeDims(cleanDims),
    });
    const dirty = await measureEntropy(".", {
      collectSources: () => MOCK_SOURCES,
      analyze: async () => makeDims(dirtyDims),
    });
    expect(clean.temperature).toBeLessThan(dirty.temperature);
  });

  it("adding duplicated code raises temperature (demo requirement)", async () => {
    const before = await measureEntropy(".", {
      collectSources: () => MOCK_SOURCES,
      analyze: async () => makeDims({ duplication: 0.1 }),
    });
    const after = await measureEntropy(".", {
      collectSources: () => "// duplicate code\n" + MOCK_SOURCES + "\n" + MOCK_SOURCES,
      analyze: async () => makeDims({ duplication: 0.6 }),
    });
    expect(after.temperature).toBeGreaterThan(before.temperature);
    expect(after.projectedRewriteWeeks).toBeLessThan(before.projectedRewriteWeeks);
  });
});

// ── Trajectory integration ────────────────────────────────────────────────────

describe("measureEntropy — trajectory projection", () => {
  it("uses DB history for projected weeks when available", async () => {
    const now = Date.now();
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
    // rose 0.2 in 2 weeks → rate = 0.1/week; current temp=0.5, gap=0.5 → 5 weeks
    const mockHistory = vi.fn().mockResolvedValue([
      makeStoredPoint(0.5, new Date(now - 1000).toISOString()),
      makeStoredPoint(0.3, new Date(twoWeeksAgo).toISOString()),
    ]);
    const result = await measureEntropy(".", {
      collectSources: () => MOCK_SOURCES,
      analyze: async () => makeDims({ vulnDensity: 0.5 }),
      listHistory: mockHistory,
    });
    // Temperature ≈ 0.25*0.1 + 0.15*0.2 + 0.20*0.3 + 0.25*0.5 + 0.15*0.2 = 0.31
    // gap = 1.0 - 0.31 = 0.69; rate ≈ 0.1/week → ~7 weeks
    expect(result.projectedRewriteWeeks).toBeGreaterThan(0);
    expect(result.projectedRewriteWeeks).toBeLessThan(100);
  });
});

// ── Gemini fallback ───────────────────────────────────────────────────────────

describe("measureEntropy — deterministic fallback", () => {
  it("succeeds without analyze dep when Gemini fails (deterministic fallback)", async () => {
    const { gemini } = await import("@helix/ai");
    vi.mocked(gemini.analyze).mockRejectedValue(new Error("GEMINI_API_KEY is not set"));

    const result = await measureEntropy(".", {
      collectSources: () => MOCK_SOURCES,
    });
    // Should still return a valid point using deterministic analysis
    expect(result.temperature).toBeGreaterThanOrEqual(0);
    expect(result.temperature).toBeLessThanOrEqual(1);
    expect(typeof result.projectedRewriteWeeks).toBe("number");
  });

  it("detects vulnDensity from HELIX-DEMO-VULN markers in source", async () => {
    const { gemini } = await import("@helix/ai");
    vi.mocked(gemini.analyze).mockRejectedValue(new Error("no key"));

    const vulnSources = "// HELIX-DEMO-VULN\n".repeat(10) + "\nexport const x = 1;\n".repeat(5);
    const result = await measureEntropy(".", {
      collectSources: () => vulnSources,
    });
    expect(result.dims.vulnDensity).toBeGreaterThan(0);
  });
});

// ── Error cases ───────────────────────────────────────────────────────────────

describe("measureEntropy — error cases", () => {
  it("throws ValidationError when collectSources returns empty string", async () => {
    const err = await measureEntropy(".", {
      collectSources: () => "   ",
      analyze: async () => makeDims(),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toMatch(/no TypeScript source files/i);
  });

  it("propagates analyze errors to the caller when injected analyze dep is used", async () => {
    const err = await measureEntropy(".", {
      collectSources: () => MOCK_SOURCES,
      analyze: async () => { throw new Error("Custom analysis error"); },
    }).catch((e: unknown) => e);
    expect((err as Error).message).toContain("Custom analysis error");
  });

  it("does not persist to DB when analysis fails", async () => {
    await measureEntropy(".", {
      collectSources: () => MOCK_SOURCES,
      analyze: async () => { throw new Error("fail"); },
    }).catch(() => null);
    expect(mockCreateEntropyPoint).not.toHaveBeenCalled();
  });
});
