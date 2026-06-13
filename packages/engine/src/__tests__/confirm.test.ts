import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Vulnerability } from "@helix/shared";
import type { HelixDoc } from "@helix/db";

// Mock external deps before importing confirmFinding
vi.mock("@helix/db", () => ({
  connectDb: vi.fn().mockResolvedValue(undefined),
  updateVulnerability: vi.fn().mockResolvedValue(null),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import { confirmFinding } from "../immune/confirm.js";
import { updateVulnerability } from "@helix/db";

function makeRes(body: string, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    text: () => Promise.resolve(body),
    headers: { forEach: vi.fn() },
  });
}

function makeFinding(partial: Partial<Vulnerability> & { class: Vulnerability["class"] }): HelixDoc<Vulnerability> {
  return {
    _id: "test-id-001",
    class: partial.class,
    endpoint: partial.endpoint ?? "/api/products/search",
    evidence: "initial evidence",
    reAttack: { before: "open", after: "open" },
    status: "open",
    detectedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  vi.mocked(updateVulnerability).mockClear();
});

const TARGET = "http://localhost:3001";

describe("confirmFinding — SQLi", () => {
  it("confirms SQLi when tautology returns more rows than contradiction", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (String(url).includes("OR")) {
        return makeRes(JSON.stringify({ products: [{ id: 1 }, { id: 2 }, { id: 3 }] }));
      }
      // contradiction returns 0 rows
      return makeRes(JSON.stringify({ products: [] }));
    });

    const finding = makeFinding({ class: "SQLi" });
    const confirmed = await confirmFinding(finding, TARGET);

    expect(confirmed).toBe(true);
    expect(updateVulnerability).toHaveBeenCalledWith("test-id-001", expect.objectContaining({
      evidence: expect.stringContaining("CONFIRMED SQLi"),
    }));
  });

  it("does not confirm SQLi when rows are equal", async () => {
    mockFetch.mockResolvedValue(makeRes(JSON.stringify({ products: [] })));

    const finding = makeFinding({ class: "SQLi" });
    const confirmed = await confirmFinding(finding, TARGET);

    expect(confirmed).toBe(false);
    expect(updateVulnerability).toHaveBeenCalledWith("test-id-001", expect.objectContaining({
      evidence: expect.stringContaining("SQLi differential failed"),
    }));
  });
});

describe("confirmFinding — XSS", () => {
  it("confirms XSS when script tag is reflected unescaped", async () => {
    mockFetch.mockImplementation((url: string) => {
      const q = decodeURIComponent(String(url).split("q=")[1] ?? "");
      return makeRes(`<html><body>${q}</body></html>`);
    });

    const finding = makeFinding({ class: "XSS", endpoint: "/search" });
    const confirmed = await confirmFinding(finding, TARGET);

    expect(confirmed).toBe(true);
    expect(updateVulnerability).toHaveBeenCalledWith("test-id-001", expect.objectContaining({
      evidence: expect.stringContaining("CONFIRMED XSS"),
    }));
  });

  it("does not confirm XSS when payload is escaped", async () => {
    mockFetch.mockResolvedValue(makeRes(`<html><body>&lt;script&gt;</body></html>`));

    const finding = makeFinding({ class: "XSS", endpoint: "/search" });
    const confirmed = await confirmFinding(finding, TARGET);

    expect(confirmed).toBe(false);
  });
});

describe("confirmFinding — missingRLS", () => {
  it("confirms missingRLS when multiple user UUIDs are visible", async () => {
    const body = JSON.stringify({
      orders: [
        { id: 1, user_id: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff" },
        { id: 2, user_id: "cccccccc-dddd-eeee-ffff-000000000000" },
        { id: 3, user_id: "dddddddd-eeee-ffff-0000-111111111111" },
      ],
    });
    mockFetch.mockResolvedValue(makeRes(body));

    const finding = makeFinding({ class: "missingRLS", endpoint: "/admin/orders" });
    const confirmed = await confirmFinding(finding, TARGET);

    expect(confirmed).toBe(true);
    expect(updateVulnerability).toHaveBeenCalledWith("test-id-001", expect.objectContaining({
      evidence: expect.stringContaining("CONFIRMED missingRLS"),
    }));
  });

  it("does not confirm missingRLS with only one UUID", async () => {
    const body = JSON.stringify({
      orders: [
        { id: 1, user_id: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff" },
      ],
    });
    mockFetch.mockResolvedValue(makeRes(body));

    const finding = makeFinding({ class: "missingRLS", endpoint: "/admin/orders" });
    const confirmed = await confirmFinding(finding, TARGET);

    expect(confirmed).toBe(false);
  });
});

describe("confirmFinding — secretLeak", () => {
  it("confirms secretLeak when service key is found in JS bundle", async () => {
    mockFetch.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes("/search")) {
        return makeRes(`<html><script src="/_next/static/chunks/app/layout.js"></script></html>`);
      }
      if (u.includes("layout.js")) {
        return makeRes(`(()=>{var s="HELIX_DEMO_FAKE_KEY_DO_NOT_USE_IN_PRODUCTION"})();`);
      }
      return makeRes("{}");
    });

    const finding = makeFinding({ class: "secretLeak", endpoint: "/" });
    const confirmed = await confirmFinding(finding, TARGET);

    expect(confirmed).toBe(true);
    expect(updateVulnerability).toHaveBeenCalledWith("test-id-001", expect.objectContaining({
      evidence: expect.stringContaining("CONFIRMED secretLeak"),
    }));
  });

  it("does not confirm secretLeak when no patterns match", async () => {
    mockFetch.mockResolvedValue(makeRes(`<html><body>no secrets here</body></html>`));

    const finding = makeFinding({ class: "secretLeak", endpoint: "/" });
    const confirmed = await confirmFinding(finding, TARGET);

    expect(confirmed).toBe(false);
  });
});

describe("confirmFinding — authBypass", () => {
  it("confirms authBypass when endpoint returns 200 without credentials", async () => {
    mockFetch.mockResolvedValue(makeRes("<html>" + "x".repeat(200) + "</html>"));

    const finding = makeFinding({ class: "authBypass", endpoint: "/admin/orders" });
    const confirmed = await confirmFinding(finding, TARGET);

    expect(confirmed).toBe(true);
  });

  it("does not confirm authBypass on 403", async () => {
    mockFetch.mockResolvedValue(makeRes("Forbidden", 403));

    const finding = makeFinding({ class: "authBypass", endpoint: "/admin/orders" });
    const confirmed = await confirmFinding(finding, TARGET);

    expect(confirmed).toBe(false);
  });
});

describe("confirmFinding — evidence always persisted", () => {
  it("calls updateVulnerability even when finding is not confirmed", async () => {
    mockFetch.mockResolvedValue(makeRes("{}"));

    const finding = makeFinding({ class: "SQLi" });
    await confirmFinding(finding, TARGET);

    expect(updateVulnerability).toHaveBeenCalledOnce();
  });
});
