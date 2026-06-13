import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "@helix/shared";
import type { Vulnerability, Incident, EntropyPoint, Homeostasis } from "@helix/shared";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockConnectDb, mockCreateHomeostasis } = vi.hoisted(() => ({
  mockConnectDb: vi.fn().mockResolvedValue(undefined),
  mockCreateHomeostasis: vi.fn(),
}));

vi.mock("@helix/db", () => ({
  connectDb: mockConnectDb,
  listVulnerabilities: vi.fn(),
  listIncidents: vi.fn(),
  listEntropyPoints: vi.fn(),
  createHomeostasis: mockCreateHomeostasis,
}));

import { checkHomeostasis, parseWindowMs } from "../governor/homeostasis.js";
import type { CheckHomeostasisDeps } from "../governor/homeostasis.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function makeVuln(
  overrides: Partial<Vulnerability & { _id: string }> = {},
): Vulnerability & { _id: string } {
  return {
    _id: `v-${Math.random().toString(36).slice(2, 8)}`,
    class: "SQLi",
    endpoint: "/api/products/search",
    evidence: "OR '1'='1'",
    reAttack: { before: "open", after: "open" },
    status: "open",
    detectedAt: hoursAgo(2),
    ...overrides,
  };
}

function makeIncident(overrides: Partial<Incident & { _id: string }> = {}): Incident & { _id: string } {
  return {
    _id: `i-${Math.random().toString(36).slice(2, 8)}`,
    incidentId: `inc-${Math.random().toString(36).slice(2, 8)}`,
    deployId: "deploy-001",
    detectedAt: hoursAgo(2),
    baselineDelta: 300,
    causalChain: [],
    failingRequest: {},
    userImpactSeconds: 120,
    ...overrides,
  };
}

function makeEntropy(temperature: number): EntropyPoint & { _id: string } {
  return {
    _id: "ep-001",
    ts: hoursAgo(1),
    temperature,
    dims: {
      duplication: 0.3,
      patternVariance: 0.6,
      coupling: 0.2,
      vulnDensity: 0.8,
      comprehension: 0.5,
    },
    projectedRewriteWeeks: 25,
  };
}

function persistCapture() {
  const captured: Homeostasis[] = [];
  const persist = vi.fn().mockImplementation(async (data: Homeostasis) => {
    captured.push(data);
    return { _id: "h-001", ...data };
  });
  return { persist, captured };
}

function baseDeps(overrides: Partial<CheckHomeostasisDeps> = {}): CheckHomeostasisDeps {
  const { persist } = persistCapture();
  return {
    listVulns: async () => [],
    listIncidents: async () => [],
    latestEntropy: async () => null,
    persist,
    ...overrides,
  };
}

beforeEach(() => {
  mockConnectDb.mockClear();
  mockCreateHomeostasis.mockClear();
});

// ── parseWindowMs ─────────────────────────────────────────────────────────────

describe("parseWindowMs", () => {
  it("parses hours", () => expect(parseWindowMs("24h")).toBe(24 * 60 * 60 * 1000));
  it("parses days", () => expect(parseWindowMs("7d")).toBe(7 * 24 * 60 * 60 * 1000));
  it("parses weeks", () => expect(parseWindowMs("2w")).toBe(2 * 7 * 24 * 60 * 60 * 1000));
  it("throws on invalid format", () => {
    expect(() => parseWindowMs("bad")).toThrow(ValidationError);
    expect(() => parseWindowMs("24m")).toThrow(ValidationError);
    expect(() => parseWindowMs("")).toThrow(ValidationError);
  });
});

// ── Action: ok ────────────────────────────────────────────────────────────────

describe("checkHomeostasis — action: ok", () => {
  it("returns ok when no vulns, no incidents, low temperature", async () => {
    const { persist, captured } = persistCapture();
    const result = await checkHomeostasis("24h", {
      ...baseDeps(),
      latestEntropy: async () => makeEntropy(0.3),
      persist,
    });
    expect(result.action).toBe("ok");
    expect(captured[0]?.action).toBe("ok");
  });

  it("ok has zero balance when nothing happened in the window", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      latestEntropy: async () => makeEntropy(0.2),
    }));
    expect(result.balance).toBe(0);
    expect(result.generationRate).toBe(0);
    expect(result.repairRate).toBe(0);
  });

  it("ok when repairRate === generationRate and temperature is low", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      listVulns: async () => [makeVuln({ status: "healed", healedAt: hoursAgo(1) })],
      listIncidents: async () => [makeIncident({ rollbackAt: hoursAgo(1) })],
      latestEntropy: async () => makeEntropy(0.3),
    }));
    expect(result.balance).toBe(0); // 1 gen + 1 repair = 0
    expect(result.action).toBe("ok");
  });
});

// ── Action: reprioritise ──────────────────────────────────────────────────────

describe("checkHomeostasis — action: reprioritise", () => {
  it("reprioritise when there is at least one open non-critical vuln (even at low temperature)", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      // XSS is non-critical — must not gate, only reprioritise
      listVulns: async () => [makeVuln({ class: "XSS", status: "open" })],
      latestEntropy: async () => makeEntropy(0.2),
    }));
    expect(result.action).toBe("reprioritise");
  });

  it("reprioritise when temperature ≥ 0.5 even with no open issues", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      latestEntropy: async () => makeEntropy(0.5),
    }));
    expect(result.action).toBe("reprioritise");
  });

  it("reprioritise when balance < 0 (more generated than repaired)", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      listVulns: async () => [
        makeVuln({ class: "XSS", status: "open" }),
        makeVuln({ class: "XSS", status: "open" }),
      ],
      latestEntropy: async () => makeEntropy(0.2),
    }));
    // 2 generated, 0 repaired → balance = -2
    expect(result.balance).toBe(-2);
    expect(result.action).toBe("reprioritise");
  });

  it("does NOT gate when non-critical classes (XSS/missingRLS) are open", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      listVulns: async () => [
        makeVuln({ class: "XSS", status: "open" }),
        makeVuln({ class: "missingRLS", status: "open" }),
      ],
      latestEntropy: async () => makeEntropy(0.3),
    }));
    // open vulns but not critical → reprioritise, not gate
    expect(result.action).toBe("reprioritise");
  });
});

// ── Action: gate ──────────────────────────────────────────────────────────────

describe("checkHomeostasis — action: gate", () => {
  it("gates when temperature ≥ 0.8", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      latestEntropy: async () => makeEntropy(0.85),
    }));
    expect(result.action).toBe("gate");
  });

  it("gates when balance ≤ -3", async () => {
    const vulns = Array.from({ length: 3 }, () =>
      makeVuln({ class: "XSS", status: "open" }),
    );
    const result = await checkHomeostasis("24h", baseDeps({
      listVulns: async () => vulns,
      latestEntropy: async () => makeEntropy(0.2),
    }));
    // 3 generated, 0 repaired → balance = -3 → gate
    expect(result.balance).toBe(-3);
    expect(result.action).toBe("gate");
  });

  it("gates when a SQLi vuln is open regardless of temperature", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      listVulns: async () => [makeVuln({ class: "SQLi", status: "open" })],
      latestEntropy: async () => makeEntropy(0.1),
    }));
    expect(result.action).toBe("gate");
  });

  it("gates when an authBypass vuln is open regardless of temperature", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      listVulns: async () => [makeVuln({ class: "authBypass", status: "open" })],
      latestEntropy: async () => makeEntropy(0.1),
    }));
    expect(result.action).toBe("gate");
  });

  it("gates even when SQLi vuln is in patching status", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      listVulns: async () => [makeVuln({ class: "SQLi", status: "patching" })],
      latestEntropy: async () => makeEntropy(0.1),
    }));
    expect(result.action).toBe("gate");
  });

  it("does NOT gate for a SQLi vuln that is healed", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      listVulns: async () => [
        makeVuln({ class: "SQLi", status: "healed", healedAt: hoursAgo(1) }),
      ],
      latestEntropy: async () => makeEntropy(0.2),
    }));
    expect(result.action).toBe("ok");
  });
});

// ── Window filtering ──────────────────────────────────────────────────────────

describe("checkHomeostasis — window filtering", () => {
  it("excludes vulns detected before the window from generationRate", async () => {
    const result = await checkHomeostasis("1h", baseDeps({
      // Detected 2h ago — outside the 1h window; XSS so non-critical
      listVulns: async () => [makeVuln({ class: "XSS", detectedAt: hoursAgo(2), status: "open" })],
      latestEntropy: async () => makeEntropy(0.1),
    }));
    expect(result.generationRate).toBe(0);
    // Vuln is still open (non-critical) → reprioritise from openVulns check
    expect(result.action).toBe("reprioritise");
  });

  it("includes vulns detected within the window", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      listVulns: async () => [makeVuln({ detectedAt: hoursAgo(12), status: "open" })],
      latestEntropy: async () => makeEntropy(0.1),
    }));
    expect(result.generationRate).toBe(1);
  });

  it("counts incidents in window for generationRate", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      listIncidents: async () => [makeIncident({ detectedAt: hoursAgo(6) })],
      latestEntropy: async () => makeEntropy(0.1),
    }));
    expect(result.generationRate).toBe(1);
  });

  it("counts resolved incidents in window for repairRate", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      listIncidents: async () => [
        makeIncident({ detectedAt: hoursAgo(6), rollbackAt: hoursAgo(5) }),
      ],
      latestEntropy: async () => makeEntropy(0.1),
    }));
    expect(result.repairRate).toBe(1);
  });

  it("balance correctly reflects multi-organ activity in window", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      listVulns: async () => [
        makeVuln({ detectedAt: hoursAgo(10), status: "healed", healedAt: hoursAgo(5) }),
        makeVuln({ detectedAt: hoursAgo(8), status: "open" }),
      ],
      listIncidents: async () => [
        makeIncident({ detectedAt: hoursAgo(12), rollbackAt: hoursAgo(6) }),
      ],
      latestEntropy: async () => makeEntropy(0.3),
    }));
    // generated: 2 vulns + 1 incident = 3
    // repaired: 1 vuln healed + 1 incident resolved = 2
    // balance: 2 - 3 = -1
    expect(result.generationRate).toBe(3);
    expect(result.repairRate).toBe(2);
    expect(result.balance).toBe(-1);
  });
});

// ── hottestZones ──────────────────────────────────────────────────────────────

describe("checkHomeostasis — hottestZones", () => {
  it("includes open vuln endpoints in hottestZones", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      listVulns: async () => [
        makeVuln({ endpoint: "/api/products/search", class: "SQLi", status: "open" }),
      ],
      latestEntropy: async () => makeEntropy(0.2),
    }));
    expect(result.hottestZones).toContain("/api/products/search [SQLi]");
  });

  it("includes entropy hottest dim when temperature ≥ 0.5", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      latestEntropy: async () => ({
        ...makeEntropy(0.6),
        dims: { duplication: 0.1, patternVariance: 0.9, coupling: 0.3, vulnDensity: 0.5, comprehension: 0.4 },
      }),
    }));
    expect(result.hottestZones.some((z) => z.startsWith("entropy:patternVariance"))).toBe(true);
  });

  it("does NOT add entropy zone when temperature < 0.5", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      latestEntropy: async () => makeEntropy(0.4),
    }));
    expect(result.hottestZones.every((z) => !z.startsWith("entropy:"))).toBe(true);
  });

  it("caps hottestZones at 5 entries", async () => {
    const vulns = Array.from({ length: 10 }, (_, i) =>
      makeVuln({ endpoint: `/api/ep${i}`, class: "XSS", status: "open" }),
    );
    const result = await checkHomeostasis("24h", baseDeps({
      listVulns: async () => vulns,
      latestEntropy: async () => makeEntropy(0.3),
    }));
    expect(result.hottestZones.length).toBeLessThanOrEqual(5);
  });
});

// ── Persistence ───────────────────────────────────────────────────────────────

describe("checkHomeostasis — persistence", () => {
  it("persists the Homeostasis record with all fields", async () => {
    const { persist, captured } = persistCapture();
    await checkHomeostasis("24h", baseDeps({
      latestEntropy: async () => makeEntropy(0.3),
      persist,
    }));
    expect(persist).toHaveBeenCalledTimes(1);
    const saved = captured[0]!;
    expect(saved.window).toBe("24h");
    expect(saved.action).toBe("ok");
    expect(typeof saved.generationRate).toBe("number");
    expect(typeof saved.repairRate).toBe("number");
    expect(typeof saved.balance).toBe("number");
    expect(Array.isArray(saved.hottestZones)).toBe(true);
  });

  it("returns the persisted HelixDoc with _id", async () => {
    const result = await checkHomeostasis("24h", baseDeps());
    expect(result._id).toBe("h-001");
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("checkHomeostasis — validation", () => {
  it("throws ValidationError for an invalid window format", async () => {
    await expect(checkHomeostasis("bad", baseDeps())).rejects.toThrow(ValidationError);
  });

  it("accepts window in hours, days, weeks", async () => {
    await expect(checkHomeostasis("12h", baseDeps())).resolves.toBeDefined();
    await expect(checkHomeostasis("7d", baseDeps())).resolves.toBeDefined();
    await expect(checkHomeostasis("2w", baseDeps())).resolves.toBeDefined();
  });
});

// ── No entropy fallback ───────────────────────────────────────────────────────

describe("checkHomeostasis — no entropy fallback", () => {
  it("treats temperature as 0 when no entropy point exists", async () => {
    const result = await checkHomeostasis("24h", baseDeps({
      latestEntropy: async () => null,
    }));
    // temperature = 0, no vulns, no incidents → ok
    expect(result.action).toBe("ok");
  });
});
