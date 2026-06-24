import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "@helix/shared";
import type { ShadowProof } from "@helix/shared";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const {
  mockConnectDb,
  mockListEntropyPoints,
  mockCreateEntropyPoint,
  mockMkdirSync,
  mockWriteFileSync,
} = vi.hoisted(() => ({
  mockConnectDb: vi.fn().mockResolvedValue(undefined),
  mockListEntropyPoints: vi.fn(),
  mockCreateEntropyPoint: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
}));

vi.mock("@helix/db", () => ({
  connectDb: mockConnectDb,
  listEntropyPoints: mockListEntropyPoints,
  createEntropyPoint: mockCreateEntropyPoint,
}));

vi.mock("@helix/ai", () => ({
  groq: { chat: vi.fn() },
  gemini: { analyze: vi.fn() },
}));

vi.mock("fs", () => ({
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
  readdirSync: vi.fn().mockReturnValue([]),
  readFileSync: vi.fn().mockReturnValue(""),
  existsSync: vi.fn().mockReturnValue(true),
}));

import { consolidate } from "../metabolism/consolidator.js";
import type { Duplication, ConsolidateEvent } from "../metabolism/consolidator.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_SOURCES = `
// FILE: apps/target/src/app/api/products/search/route.ts
interface Product { id: string; name: string; price: number; description: string; }
const MOCK_PRODUCTS: Product[] = [{ id: "1", name: "Widget Pro", price: 29.99, description: "A widget" }];

// FILE: apps/target/src/app/search/page.tsx
interface Product { id: string; name: string; price: number; description: string; }
`.trim();

const DUP_PRODUCT: Duplication = {
  id: "product-interface",
  pattern: "interface Product { id, name, price, description }",
  files: [
    "apps/target/src/app/api/products/search/route.ts",
    "apps/target/src/app/search/page.tsx",
  ],
  consolidationTarget: "apps/target/src/types/product.ts",
  rationale: "Identical Product interface duplicated across route and page — extract to shared types.",
};

const SUGGESTED_DIFF_TYPES = [
  "--- /dev/null",
  "+++ b/apps/target/src/types/product.ts",
  "@@ -0,0 +1,6 @@",
  "+export interface Product {",
  "+  id: string;",
  "+  name: string;",
  "+  price: number;",
  "+  description: string;",
  "+}",
].join("\n");

const SUGGESTED_DIFF_ROUTE = [
  "--- a/apps/target/src/app/api/products/search/route.ts",
  "+++ b/apps/target/src/app/api/products/search/route.ts",
  "@@ -1,4 +1,2 @@",
  "-interface Product { id: string; name: string; price: number; description: string; }",
  "+import type { Product } from '@/types/product';",
].join("\n");

function makeProof(verdict: "promote" | "reject" = "promote"): ShadowProof {
  return {
    proofId: `proof-${verdict}-001`,
    changeRef: "shadow-consol-001",
    replayedCases: 2,
    intendedFixPassed: verdict === "promote",
    regressions: 0,
    verdict,
    verifiedAt: new Date().toISOString(),
  };
}

function makeBeforePoint(temp = 0.46) {
  return {
    _id: "pt-before",
    ts: new Date(Date.now() - 60_000).toISOString(),
    temperature: temp,
    dims: { duplication: 0.22, patternVariance: 0.5, coupling: 0.1, vulnDensity: 0.42, comprehension: 0.5 },
    projectedRewriteWeeks: 27,
  };
}

function makeAfterPoint(temp = 0.38) {
  return {
    _id: "pt-after",
    ts: new Date().toISOString(),
    temperature: temp,
    dims: { duplication: 0.08, patternVariance: 0.5, coupling: 0.1, vulnDensity: 0.42, comprehension: 0.5 },
    projectedRewriteWeeks: 31,
  };
}

beforeEach(() => {
  mockConnectDb.mockClear();
  mockListEntropyPoints.mockClear();
  mockCreateEntropyPoint.mockClear();
  mockMkdirSync.mockClear();
  mockWriteFileSync.mockClear();

  mockListEntropyPoints.mockResolvedValue([makeBeforePoint()]);
  mockCreateEntropyPoint.mockImplementation((p: unknown) =>
    Promise.resolve({ _id: "pt-new", ...(p as object) }),
  );
});

// ── Duplication detection ─────────────────────────────────────────────────────

describe("consolidate — duplication detection", () => {
  it("calls findDuplications with the collected source bundle", async () => {
    const mockFind = vi.fn().mockResolvedValue([]);
    await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: mockFind,
      measureAfter: async () => makeAfterPoint() as never,
    });
    expect(mockFind).toHaveBeenCalledWith(MOCK_SOURCES);
  });

  it("returns empty consolidated when no duplications found", async () => {
    const result = await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => [],
      measureAfter: async () => makeAfterPoint() as never,
    });
    expect(result.consolidated).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it("respects maxConsolidations limit", async () => {
    const dups: Duplication[] = Array.from({ length: 4 }, (_, i) => ({
      ...DUP_PRODUCT,
      id: `dup-${i}`,
    }));
    const mockSynth = vi.fn().mockRejectedValue(new Error("skip"));
    await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => dups,
      synthesizePatch: mockSynth,
      maxConsolidations: 2,
      measureAfter: async () => makeAfterPoint() as never,
    });
    expect(mockSynth).toHaveBeenCalledTimes(2);
  });
});

// ── Shadow gate — full happy path ─────────────────────────────────────────────

describe("consolidate — Shadow gate (happy path)", () => {
  function wiredDeps() {
    return {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => [DUP_PRODUCT],
      synthesizePatch: async () => ({
        files: [
          { path: "apps/target/src/types/product.ts", diff: SUGGESTED_DIFF_TYPES },
          { path: "apps/target/src/app/api/products/search/route.ts", diff: SUGGESTED_DIFF_ROUTE },
        ],
        rationale: "Extracted Product interface to shared types.",
      }),
      applyShadow: vi.fn().mockResolvedValue({ patchRef: "shadow-c-001", shadowUrl: "http://localhost:3002" }),
      verify: vi.fn().mockResolvedValue(makeProof("promote")),
      promote: vi.fn().mockResolvedValue(undefined as void),
      measureAfter: async () => makeAfterPoint() as never,
    };
  }

  it("applies the patch to Shadow before promoting", async () => {
    const deps = wiredDeps();
    await consolidate(".", deps);
    expect(deps.applyShadow).toHaveBeenCalledTimes(1);
    const calledPatch = (deps.applyShadow as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(calledPatch).toHaveProperty("files");
    expect(calledPatch).toHaveProperty("rationale");
  });

  it("calls verifyEquivalence with the patchRef from applyShadow", async () => {
    const deps = wiredDeps();
    await consolidate(".", deps);
    expect(deps.verify).toHaveBeenCalledWith("shadow-c-001");
  });

  it("writes meta.json to shadow staging before verifyEquivalence", async () => {
    await consolidate(".", wiredDeps());
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining("shadow-c-001"),
      expect.stringContaining("findingId"),
      "utf8",
    );
  });

  it("calls promote after assertPromotable passes", async () => {
    const deps = wiredDeps();
    await consolidate(".", deps);
    expect(deps.promote).toHaveBeenCalledTimes(1);
  });

  it("adds the duplication id to consolidated list on success", async () => {
    const result = await consolidate(".", wiredDeps());
    expect(result.consolidated).toContain("product-interface");
    expect(result.skipped).not.toContain("product-interface");
  });

  it("attaches the shadow proof to the result", async () => {
    const result = await consolidate(".", wiredDeps());
    expect(result.proofs).toHaveLength(1);
    expect(result.proofs[0]?.verdict).toBe("promote");
  });
});

// ── Shadow gate — rejection and escalation ────────────────────────────────────

describe("consolidate — Shadow gate (rejection / escalation)", () => {
  it("skips duplication when Shadow returns reject verdict", async () => {
    const mockPromote = vi.fn();
    const result = await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => [DUP_PRODUCT],
      synthesizePatch: async () => ({
        files: [{ path: "apps/target/src/types/product.ts", diff: SUGGESTED_DIFF_TYPES }],
        rationale: "extract",
      }),
      applyShadow: vi.fn().mockResolvedValue({ patchRef: "p-001", shadowUrl: "http://localhost:3002" }),
      verify: vi.fn().mockResolvedValue(makeProof("reject")),
      promote: mockPromote,
      measureAfter: async () => makeAfterPoint() as never,
    });
    expect(result.skipped).toContain("product-interface");
    expect(result.consolidated).not.toContain("product-interface");
    expect(mockPromote).not.toHaveBeenCalled();
  });

  it("NEVER calls promote when Shadow rejects — real target untouched", async () => {
    const mockPromote = vi.fn();
    await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => [DUP_PRODUCT],
      synthesizePatch: async () => ({
        files: [{ path: "apps/target/src/types/product.ts", diff: SUGGESTED_DIFF_TYPES }],
        rationale: "extract",
      }),
      applyShadow: vi.fn().mockResolvedValue({ patchRef: "p-001", shadowUrl: "http://localhost:3002" }),
      verify: vi.fn().mockResolvedValue(makeProof("reject")),
      promote: mockPromote,
      measureAfter: async () => makeAfterPoint() as never,
    });
    expect(mockPromote).not.toHaveBeenCalled();
  });

  it("skips and continues when applyShadow throws (Shadow not running)", async () => {
    const mockPromote = vi.fn();
    const result = await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => [DUP_PRODUCT],
      synthesizePatch: async () => ({
        files: [{ path: "apps/target/src/types/product.ts", diff: SUGGESTED_DIFF_TYPES }],
        rationale: "extract",
      }),
      applyShadow: vi.fn().mockRejectedValue(new Error("Shadow container not running")),
      verify: vi.fn(),
      promote: mockPromote,
      measureAfter: async () => makeAfterPoint() as never,
    });
    expect(result.skipped).toContain("product-interface");
    expect(mockPromote).not.toHaveBeenCalled();
  });

  it("skips one and consolidates another when only one Shadow approves", async () => {
    const dup2: Duplication = { ...DUP_PRODUCT, id: "order-interface" };
    const result = await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => [DUP_PRODUCT, dup2],
      synthesizePatch: async () => ({
        files: [{ path: "apps/target/src/types/product.ts", diff: SUGGESTED_DIFF_TYPES }],
        rationale: "extract",
      }),
      applyShadow: vi.fn().mockResolvedValue({ patchRef: "p-001", shadowUrl: "http://localhost:3002" }),
      verify: vi
        .fn()
        .mockResolvedValueOnce(makeProof("promote"))
        .mockResolvedValueOnce(makeProof("reject")),
      promote: vi.fn().mockResolvedValue(undefined as void),
      measureAfter: async () => makeAfterPoint() as never,
    });
    expect(result.consolidated).toContain("product-interface");
    expect(result.skipped).toContain("order-interface");
  });

  it("skips when synthesis throws — does not reach Shadow", async () => {
    const mockApply = vi.fn();
    await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => [DUP_PRODUCT],
      synthesizePatch: async () => { throw new Error("Groq timeout"); },
      applyShadow: mockApply,
      measureAfter: async () => makeAfterPoint() as never,
    });
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("skips (does not propagate) when verify throws ValidationError — partial resilience", async () => {
    const mockPromote = vi.fn();
    const result = await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => [DUP_PRODUCT],
      synthesizePatch: async () => ({
        files: [{ path: "apps/target/src/types/product.ts", diff: SUGGESTED_DIFF_TYPES }],
        rationale: "extract",
      }),
      applyShadow: vi.fn().mockResolvedValue({ patchRef: "p-001", shadowUrl: "http://localhost:3002" }),
      verify: vi.fn().mockRejectedValue(new ValidationError("unexpected")),
      promote: mockPromote,
      measureAfter: async () => makeAfterPoint() as never,
    });
    // verify error is caught-and-skipped; promote is never called; real target untouched
    expect(result.skipped).toContain("product-interface");
    expect(mockPromote).not.toHaveBeenCalled();
  });
});

// ── Before / after temperature ────────────────────────────────────────────────

describe("consolidate — before/after temperature (the §6 demo requirement)", () => {
  it("reads before temperature from the last stored entropy point", async () => {
    const before = makeBeforePoint(0.46);
    mockListEntropyPoints.mockResolvedValue([before]);
    const result = await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => [],
      measureAfter: async () => makeAfterPoint(0.38) as never,
    });
    expect(result.before.temperature).toBeCloseTo(0.46);
  });

  it("calls measureAfter to get the post-consolidation temperature", async () => {
    const mockMeasure = vi.fn().mockResolvedValue(makeAfterPoint(0.38));
    await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => [],
      measureAfter: mockMeasure,
    });
    expect(mockMeasure).toHaveBeenCalledTimes(1);
  });

  it("temperatureDelta is negative after successful consolidation", async () => {
    const result = await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => [DUP_PRODUCT],
      synthesizePatch: async () => ({
        files: [{ path: "apps/target/src/types/product.ts", diff: SUGGESTED_DIFF_TYPES }],
        rationale: "extract",
      }),
      applyShadow: vi.fn().mockResolvedValue({ patchRef: "p-001", shadowUrl: "http://localhost:3002" }),
      verify: vi.fn().mockResolvedValue(makeProof("promote")),
      promote: vi.fn().mockResolvedValue(undefined as void),
      measureAfter: async () => makeAfterPoint(0.38) as never,
    });
    // 0.38 - 0.46 = -0.08 → temperature bent down ✓
    expect(result.temperatureDelta).toBeLessThan(0);
    expect(result.after.temperature).toBeLessThan(result.before.temperature);
  });

  it("uses a zero-temperature before point when no history exists", async () => {
    mockListEntropyPoints.mockResolvedValue([]);
    const result = await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => [],
      measureAfter: async () => makeAfterPoint(0.1) as never,
    });
    expect(result.before.temperature).toBe(0);
  });
});

// ── Event emission ────────────────────────────────────────────────────────────

describe("consolidate — event emission", () => {
  it("emits a consolidated event for each successful consolidation", async () => {
    const events: ConsolidateEvent[] = [];
    await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => [DUP_PRODUCT],
      synthesizePatch: async () => ({
        files: [{ path: "apps/target/src/types/product.ts", diff: SUGGESTED_DIFF_TYPES }],
        rationale: "extract",
      }),
      applyShadow: vi.fn().mockResolvedValue({ patchRef: "p-001", shadowUrl: "http://localhost:3002" }),
      verify: vi.fn().mockResolvedValue(makeProof("promote")),
      promote: vi.fn().mockResolvedValue(undefined as void),
      measureAfter: async () => makeAfterPoint() as never,
      onEvent: (e) => { events.push(e); },
    });
    const consolidated = events.find((e) => e.outcome === "consolidated");
    expect(consolidated?.duplicationId).toBe("product-interface");
    expect(consolidated?.proofId).toBe("proof-promote-001");
  });

  it("emits an escalated event when Shadow rejects", async () => {
    const events: ConsolidateEvent[] = [];
    await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => [DUP_PRODUCT],
      synthesizePatch: async () => ({
        files: [{ path: "apps/target/src/types/product.ts", diff: SUGGESTED_DIFF_TYPES }],
        rationale: "extract",
      }),
      applyShadow: vi.fn().mockResolvedValue({ patchRef: "p-001", shadowUrl: "http://localhost:3002" }),
      verify: vi.fn().mockResolvedValue(makeProof("reject")),
      promote: vi.fn(),
      measureAfter: async () => makeAfterPoint() as never,
      onEvent: (e) => { events.push(e); },
    });
    const escalated = events.find((e) => e.outcome === "escalated");
    expect(escalated?.duplicationId).toBe("product-interface");
  });
});

// ── NOT_WIRED seams ───────────────────────────────────────────────────────────

describe("consolidate — NOT_WIRED seams", () => {
  it("skips the duplication when applyShadow is NOT_WIRED — real target never touched", async () => {
    // NOT_WIRED throws ValidationError which consolidate catches-and-skips for resilience.
    // The duplication is in skipped[], never in consolidated[].
    const result = await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => [DUP_PRODUCT],
      synthesizePatch: async () => ({
        files: [{ path: "apps/target/src/types/product.ts", diff: SUGGESTED_DIFF_TYPES }],
        rationale: "extract",
      }),
      // applyShadow NOT provided → NOT_WIRED (caught by consolidate, becomes a skip)
      measureAfter: async () => makeAfterPoint() as never,
    });
    expect(result.skipped).toContain("product-interface");
    expect(result.consolidated).toHaveLength(0);
  });
});

// ── Error cases ───────────────────────────────────────────────────────────────

describe("consolidate — error cases", () => {
  it("throws ValidationError when collectSources returns empty string", async () => {
    const err = await consolidate(".", {
      collectSources: () => "   ",
      findDuplications: async () => [],
      measureAfter: async () => makeAfterPoint() as never,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toMatch(/no source files/i);
  });

  it("propagates findDuplications errors to the caller", async () => {
    const err = await consolidate(".", {
      collectSources: () => MOCK_SOURCES,
      findDuplications: async () => { throw new Error("Groq rate limit"); },
      measureAfter: async () => makeAfterPoint() as never,
    }).catch((e: unknown) => e);
    expect((err as Error).message).toContain("Groq rate limit");
  });
});
