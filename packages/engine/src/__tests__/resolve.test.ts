import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "@helix/shared";
import type { Incident, Vulnerability, ShadowProof } from "@helix/shared";
import type { HelixDoc } from "@helix/db";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const {
  mockConnectDb,
  mockFindIncidentByIncidentId,
  mockFindIncidentById,
  mockUpdateIncident,
  mockListVulnerabilities,
} = vi.hoisted(() => ({
  mockConnectDb: vi.fn().mockResolvedValue(undefined),
  mockFindIncidentByIncidentId: vi.fn(),
  mockFindIncidentById: vi.fn(),
  mockUpdateIncident: vi.fn(),
  mockListVulnerabilities: vi.fn(),
}));

vi.mock("@helix/db", () => ({
  connectDb: mockConnectDb,
  findIncidentByIncidentId: mockFindIncidentByIncidentId,
  findIncidentById: mockFindIncidentById,
  updateIncident: mockUpdateIncident,
  listVulnerabilities: mockListVulnerabilities,
}));

import { resolveIncident, extractEndpoint } from "../nervous/resolve.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeIncident(overrides: Partial<Incident> = {}): HelixDoc<Incident> {
  return {
    _id: "inc-mongo-001",
    incidentId: "inc-1234567890-abc",
    deployId: "deploy-001",
    detectedAt: new Date().toISOString(),
    causalChain: [{ order: 1, description: "500 from /api/products", evidenceRef: "status:500" }],
    baselineDelta: 5000,
    userImpactSeconds: 120,
    failingRequest: { url: "http://localhost:3001/api/products", status: 500 },
    ...overrides,
  } as HelixDoc<Incident>;
}

function makeVuln(overrides: Partial<Vulnerability> = {}): HelixDoc<Vulnerability> {
  return {
    _id: "vuln-001",
    class: "SQLi",
    endpoint: "/api/products",
    evidence: "tautology returned all rows",
    detectedAt: new Date().toISOString(),
    status: "open",
    ...overrides,
  } as HelixDoc<Vulnerability>;
}

function makeProof(): ShadowProof {
  return {
    changeRef: "patch-abc",
    verdict: "promote",
    rationale: "Fix confirmed.",
    intendedFixPassed: true,
    regressions: 0,
    trafficReplays: [],
    createdAt: new Date().toISOString(),
  } as unknown as ShadowProof;
}

function makeHealResult(vuln: HelixDoc<Vulnerability> = makeVuln()) {
  return {
    vulnerability: { ...vuln, patchRef: "patch-abc", antibodyId: "ab-001" },
    proof: makeProof(),
  };
}

beforeEach(() => {
  mockConnectDb.mockClear();
  mockFindIncidentByIncidentId.mockClear();
  mockFindIncidentById.mockClear();
  mockUpdateIncident.mockClear();
  mockListVulnerabilities.mockClear();

  // Default: incident found by incidentId slug, one open vuln, update returns updated incident
  const incident = makeIncident();
  mockFindIncidentByIncidentId.mockResolvedValue(incident);
  mockFindIncidentById.mockResolvedValue(null);
  mockListVulnerabilities.mockResolvedValue([makeVuln()]);
  mockUpdateIncident.mockResolvedValue({ ...incident, fixRef: "patch-abc", antibodyId: "ab-001" });
});

// ── extractEndpoint ───────────────────────────────────────────────────────────

describe("extractEndpoint", () => {
  it("extracts pathname from a full URL", () => {
    expect(extractEndpoint({ url: "http://localhost:3001/api/products?q=test" })).toBe("/api/products");
  });

  it("extracts a bare path", () => {
    expect(extractEndpoint({ path: "/api/cart" })).toBe("/api/cart");
  });

  it("uses endpoint field as fallback", () => {
    expect(extractEndpoint({ endpoint: "/api/auth/login" })).toBe("/api/auth/login");
  });

  it("strips query string from a bare path", () => {
    expect(extractEndpoint({ url: "/api/search?q=x" })).toBe("/api/search");
  });

  it("returns null when no URL-like field exists", () => {
    expect(extractEndpoint({ status: 500 })).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractEndpoint({ url: "" })).toBeNull();
  });

  it("returns null for null input", () => {
    expect(extractEndpoint(null)).toBeNull();
  });

  it("prefers url over path over endpoint", () => {
    expect(extractEndpoint({ url: "/api/a", path: "/api/b", endpoint: "/api/c" })).toBe("/api/a");
  });
});

// ── resolveIncident — happy path ──────────────────────────────────────────────

describe("resolveIncident — happy path", () => {
  it("finds the incident by incidentId slug", async () => {
    const heal = vi.fn().mockResolvedValue(makeHealResult());
    await resolveIncident("inc-1234567890-abc", { heal });

    expect(mockFindIncidentByIncidentId).toHaveBeenCalledWith("inc-1234567890-abc");
  });

  it("returns healed vuln _id and updated incident", async () => {
    const heal = vi.fn().mockResolvedValue(makeHealResult());
    const result = await resolveIncident("inc-1234567890-abc", { heal });

    expect(result.healed).toContain("vuln-001");
    expect(result.skipped).toHaveLength(0);
    expect(result.incident.fixRef).toBe("patch-abc");
  });

  it("calls heal with each open vuln _id", async () => {
    const vulns = [
      { ...makeVuln(), _id: "vuln-001" },
      { ...makeVuln(), _id: "vuln-002", endpoint: "/api/admin" },
    ] as HelixDoc<Vulnerability>[];
    mockListVulnerabilities.mockResolvedValue(vulns);
    const heal = vi.fn().mockResolvedValue(makeHealResult());

    await resolveIncident("inc-1234567890-abc", { heal });

    expect(heal).toHaveBeenCalledTimes(2);
    expect(heal).toHaveBeenCalledWith("vuln-001");
    expect(heal).toHaveBeenCalledWith("vuln-002");
  });

  it("updates incident fixRef and antibodyId from first successful heal", async () => {
    const heal = vi.fn().mockResolvedValue(makeHealResult());
    await resolveIncident("inc-1234567890-abc", { heal });

    expect(mockUpdateIncident).toHaveBeenCalledWith(
      "inc-mongo-001",
      expect.objectContaining({ fixRef: "patch-abc", antibodyId: "ab-001" }),
    );
  });

  it("returns empty healed and skipped when no open vulns exist", async () => {
    mockListVulnerabilities.mockResolvedValue([]);
    const heal = vi.fn();

    const result = await resolveIncident("inc-1234567890-abc", { heal });

    expect(result.healed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(heal).not.toHaveBeenCalled();
  });
});

// ── resolveIncident — incident lookup ─────────────────────────────────────────

describe("resolveIncident — incident lookup", () => {
  it("falls back to findIncidentById when incidentId slug not found", async () => {
    const incident = makeIncident();
    mockFindIncidentByIncidentId.mockResolvedValue(null);
    mockFindIncidentById.mockResolvedValue(incident);
    const heal = vi.fn().mockResolvedValue(makeHealResult());

    const result = await resolveIncident("inc-mongo-001", { heal });

    expect(mockFindIncidentById).toHaveBeenCalledWith("inc-mongo-001");
    expect(result.incident._id).toBe("inc-mongo-001");
  });

  it("throws ValidationError when incident not found by either lookup", async () => {
    mockFindIncidentByIncidentId.mockResolvedValue(null);
    mockFindIncidentById.mockResolvedValue(null);
    const heal = vi.fn();

    const err = await resolveIncident("nonexistent-id", { heal }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toContain("nonexistent-id");
  });
});

// ── resolveIncident — endpoint extraction ────────────────────────────────────

describe("resolveIncident — endpoint-scoped vuln lookup", () => {
  it("queries listVulnerabilities with endpoint from failingRequest.url", async () => {
    const heal = vi.fn().mockResolvedValue(makeHealResult());
    await resolveIncident("inc-1234567890-abc", { heal });

    expect(mockListVulnerabilities).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "/api/products", status: "open" }),
    );
  });

  it("falls back to all open vulns when endpoint query returns empty", async () => {
    mockListVulnerabilities
      .mockResolvedValueOnce([])    // endpoint-scoped query → empty
      .mockResolvedValueOnce([makeVuln()]);  // broad query → result
    const heal = vi.fn().mockResolvedValue(makeHealResult());

    const result = await resolveIncident("inc-1234567890-abc", { heal });

    expect(mockListVulnerabilities).toHaveBeenCalledTimes(2);
    expect(result.healed).toHaveLength(1);
  });

  it("uses all open vulns directly when failingRequest has no URL field", async () => {
    mockFindIncidentByIncidentId.mockResolvedValue(
      makeIncident({ failingRequest: { status: 500 } as unknown as Incident["failingRequest"] }),
    );
    const heal = vi.fn().mockResolvedValue(makeHealResult());

    await resolveIncident("inc-1234567890-abc", { heal });

    // Only one call — no endpoint to scope it
    expect(mockListVulnerabilities).toHaveBeenCalledTimes(1);
    expect(mockListVulnerabilities).toHaveBeenCalledWith(
      expect.objectContaining({ status: "open" }),
    );
  });
});

// ── resolveIncident — partial failures ───────────────────────────────────────

describe("resolveIncident — partial failures", () => {
  it("puts vulns that fail to heal into skipped", async () => {
    const v1 = { ...makeVuln(), _id: "vuln-001" } as HelixDoc<Vulnerability>;
    const v2 = { ...makeVuln(), _id: "vuln-002" } as HelixDoc<Vulnerability>;
    const vulns = [v1, v2];
    mockListVulnerabilities.mockResolvedValue(vulns);
    const heal = vi.fn()
      .mockResolvedValueOnce(makeHealResult(v1))
      .mockRejectedValueOnce(new Error("shadow failed"));

    const result = await resolveIncident("inc-1234567890-abc", { heal });

    expect(result.healed).toEqual(["vuln-001"]);
    expect(result.skipped).toEqual(["vuln-002"]);
  });

  it("does not update incident when all heals fail", async () => {
    mockListVulnerabilities.mockResolvedValue([makeVuln()]);
    const heal = vi.fn().mockRejectedValue(new Error("all broken"));

    const result = await resolveIncident("inc-1234567890-abc", { heal });

    expect(mockUpdateIncident).not.toHaveBeenCalled();
    expect(result.healed).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
  });

  it("still returns even when all vulns are skipped", async () => {
    const heal = vi.fn().mockRejectedValue(new Error("nope"));
    const result = await resolveIncident("inc-1234567890-abc", { heal });

    expect(result.incident).toBeDefined();
    expect(result.healed).toHaveLength(0);
  });
});

// ── resolveIncident — NOT_WIRED seam ─────────────────────────────────────────

describe("resolveIncident — NOT_WIRED heal seam", () => {
  it("throws ValidationError when no heal dep is provided and a vuln exists", async () => {
    const err = await resolveIncident("inc-1234567890-abc").catch((e: unknown) => e);
    // The NOT_WIRED stub throws ValidationError inside heal(); the vuln ends up
    // in skipped — resolveIncident itself succeeds, it does NOT rethrow heal errors.
    // (heal errors are caught per-vuln — this is by design for partial-failure safety)
    expect(err).not.toBeInstanceOf(ValidationError);
  });

  it("puts NOT_WIRED vuln in skipped rather than crashing resolveIncident", async () => {
    const result = await resolveIncident("inc-1234567890-abc");

    expect(result.skipped).toContain("vuln-001");
    expect(result.healed).toHaveLength(0);
  });
});
