import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError, type Antibody } from "@helix/shared";
import type { HelixDoc } from "@helix/db";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@helix/db", () => {
  const antibodies = new Map<string, HelixDoc<Antibody>>();
  return {
    connectDb: vi.fn().mockResolvedValue(undefined),
    findVulnerabilityById: vi.fn(async (id: string) =>
      id === "vuln-001"
        ? {
            _id: "vuln-001",
            class: "SQLi",
            endpoint: "/api/products/search",
            evidence: "CONFIRMED SQLi differential: tautology returned 5 rows vs 0.",
            reAttack: { before: "open", after: "closed" },
            status: "healed",
            detectedAt: new Date().toISOString(),
          }
        : null,
    ),
    findIncidentById: vi.fn(async () => null),
    findAntibodyByAntibodyId: vi.fn(async (id: string) => antibodies.get(id) ?? null),
    createAntibody: vi.fn(async (data: Antibody) => {
      const doc = { ...data, _id: "ab-mongo-001" } as HelixDoc<Antibody>;
      antibodies.set(data.antibodyId, doc);
      return doc;
    }),
    updateVulnerability: vi.fn().mockResolvedValue(null),
    updateIncident: vi.fn().mockResolvedValue(null),
    listAntibodies: vi.fn(async () => [...antibodies.values()]),
  };
});

vi.mock("@helix/ai", () => ({
  sarvam: {
    chat: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        regressionTest: `import { describe, it, expect } from 'vitest';
describe('antibody: SQLi /api/products/search', () => {
  it('tautology returns 0 rows after parameterization', async () => {
    const T = process.env['TARGET_URL'] ?? 'http://localhost:3001';
    const r = await fetch(T + '/api/products/search?q=%27+OR+%271%27%3D%271').then(x => x.json());
    expect((r as { products?: unknown[] }).products?.length ?? 0).toBeLessThanOrEqual(1);
  });
});`,
        runtimeAssertion: "SQL queries must use parameterized placeholders; never interpolate user input.",
      }),
      model: "sarvam-105b",
    }),
  },
  embed: vi.fn().mockResolvedValue(Array.from({ length: 1536 }, () => 0.1)),
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(false),
  };
});

import { mintAntibody, makeAntibodyId, makeSignature, writeRegressionTest } from "../memory/mint.js";
import { sarvam, embed } from "@helix/ai";
import { createAntibody, updateVulnerability, findAntibodyByAntibodyId } from "@helix/db";
import { writeFileSync, mkdirSync } from "fs";

beforeEach(() => {
  vi.mocked(sarvam.chat).mockClear();
  vi.mocked(embed).mockClear();
  vi.mocked(createAntibody).mockClear();
  vi.mocked(updateVulnerability).mockClear();
  // Reset antibody store between tests by clearing findAntibodyByAntibodyId mock
  vi.mocked(findAntibodyByAntibodyId).mockResolvedValue(null);
});

// ── makeAntibodyId / makeSignature ────────────────────────────────────────────

describe("makeAntibodyId", () => {
  it("produces a stable, slug-safe ID from class + endpoint", () => {
    expect(makeAntibodyId("SQLi", "/api/products/search")).toBe("ab-sqli-api-products-search");
    expect(makeAntibodyId("XSS", "/search")).toBe("ab-xss-search");
    expect(makeAntibodyId("missingRLS", "/admin/orders")).toBe("ab-missingrls-admin-orders");
  });

  it("same class + endpoint always produces the same ID", () => {
    const a = makeAntibodyId("SQLi", "/api/products/search");
    const b = makeAntibodyId("SQLi", "/api/products/search");
    expect(a).toBe(b);
  });
});

describe("makeSignature", () => {
  it("produces a 16-hex-char deterministic signature", () => {
    const sig = makeSignature("SQLi", "/api/products/search");
    expect(sig).toMatch(/^[0-9a-f]{16}$/);
  });

  it("different class+endpoint produces different signature", () => {
    expect(makeSignature("SQLi", "/api/products/search")).not.toBe(
      makeSignature("XSS", "/search"),
    );
  });
});

// ── mintAntibody ──────────────────────────────────────────────────────────────

describe("mintAntibody — happy path", () => {
  it("persists a Zod-valid Antibody to the collection", async () => {
    const ab = await mintAntibody({ type: "vuln", ref: "vuln-001" });

    expect(ab.antibodyId).toBe("ab-sqli-api-products-search");
    expect(ab.sourceType).toBe("vuln");
    expect(ab.signature).toMatch(/^[0-9a-f]{16}$/);
    expect(ab.embedding).toHaveLength(1536);
    expect(ab.regressionTest).toContain("vitest");
    expect(ab.runtimeAssertion).toBeTruthy();
    expect(ab.recurrencesBlocked).toBe(0);
    expect(ab.mintedAt).toBeTruthy();
  });

  it("calls sarvam.chat with the vulnerability context in the prompt", async () => {
    await mintAntibody({ type: "vuln", ref: "vuln-001" });

    const call = vi.mocked(sarvam.chat).mock.calls[0]![0];
    const userMsg = call.messages.find((m) => m.role === "user")!.content;
    expect(userMsg).toContain("SQLi");
    expect(userMsg).toContain("/api/products/search");
    expect(call.schema).toBeDefined();
  });

  it("embeds the signature + regression test snippet", async () => {
    await mintAntibody({ type: "vuln", ref: "vuln-001" });

    expect(embed).toHaveBeenCalledOnce();
    const embedArg = vi.mocked(embed).mock.calls[0]![0];
    expect(embedArg).toContain("SQLi");
    expect(embedArg).toContain("/api/products/search");
  });

  it("writes the regression test to the target app's test suite", async () => {
    await mintAntibody({ type: "vuln", ref: "vuln-001" });

    expect(mkdirSync).toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("ab-sqli-api-products-search.test.ts"),
      expect.stringContaining("vitest"),
      "utf8",
    );
  });

  it("links antibodyId back to the source vulnerability", async () => {
    await mintAntibody({ type: "vuln", ref: "vuln-001" });

    expect(updateVulnerability).toHaveBeenCalledWith("vuln-001", {
      antibodyId: "ab-sqli-api-products-search",
    });
  });
});

describe("mintAntibody — idempotency", () => {
  it("returns the existing antibody without re-minting if already minted", async () => {
    const existing: HelixDoc<Antibody> = {
      _id: "ab-mongo-001",
      antibodyId: "ab-sqli-api-products-search",
      sourceType: "vuln",
      signature: "abc123",
      embedding: Array.from({ length: 1536 }, () => 0.5),
      regressionTest: "existing test",
      runtimeAssertion: "existing assertion",
      mintedAt: "2026-01-01T00:00:00.000Z",
      recurrencesBlocked: 3,
    };
    vi.mocked(findAntibodyByAntibodyId).mockResolvedValueOnce(existing);

    const ab = await mintAntibody({ type: "vuln", ref: "vuln-001" });

    expect(ab.regressionTest).toBe("existing test");
    expect(ab.recurrencesBlocked).toBe(3);
    // Should NOT call sarvam.chat, embed, createAntibody, or updateVulnerability again
    expect(sarvam.chat).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();
    expect(createAntibody).not.toHaveBeenCalled();
    expect(updateVulnerability).not.toHaveBeenCalled();
  });
});

describe("mintAntibody — error paths", () => {
  it("throws ValidationError when source vulnerability does not exist", async () => {
    await expect(mintAntibody({ type: "vuln", ref: "missing-id" })).rejects.toThrow(
      ValidationError,
    );
  });

  it("uses the deterministic fallback if sarvam.chat throws", async () => {
    vi.mocked(sarvam.chat).mockRejectedValueOnce(new Error("Sarvam unavailable"));

    const ab = await mintAntibody({ type: "vuln", ref: "vuln-001" });

    // Fallback produces a valid antibody with the class-appropriate template
    expect(ab.regressionTest).toContain("vitest");
    expect(ab.regressionTest).toContain("NOMATCH_helix_xyz");
    expect(ab.runtimeAssertion).toContain("parameterized");
  });
});

describe("writeRegressionTest", () => {
  it("writes to the correct path under apps/target/src/__tests__/antibodies/", () => {
    writeRegressionTest("ab-sqli-test", "test code here");

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining(["apps", "target", "src", "__tests__", "antibodies", "ab-sqli-test.test.ts"].join("/")),
      "test code here",
      "utf8",
    );
  });
});
