import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthorizationError } from "@helix/shared";

// Mock external deps before importing scanner
vi.mock("@helix/db", () => ({
  connectDb: vi.fn().mockResolvedValue(undefined),
  // Echo input back with _id — mirrors real createVulnerability behaviour.
  createVulnerability: vi.fn().mockImplementation(async (data: unknown) => ({
    ...(data as object),
    _id: "mock-id",
  })),
}));
vi.mock("@helix/ai", () => ({
  gemini: {
    analyze: vi.fn().mockResolvedValue({ content: "confirms vulnerability pattern" }),
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import { scanTarget } from "../immune/scanner.js";

function makeFetchResponse(body: string, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    text: () => Promise.resolve(body),
    headers: { forEach: vi.fn() },
  });
}

beforeEach(() => {
  process.env["TARGET_ALLOWLIST"] = "http://localhost:3001";
  mockFetch.mockReset();
});

describe("scanTarget authorization gate", () => {
  it("rejects URLs not in the allowlist", async () => {
    await expect(scanTarget("http://evil.com/api")).rejects.toThrow(AuthorizationError);
  });

  it("rejects when TARGET_ALLOWLIST is empty", async () => {
    process.env["TARGET_ALLOWLIST"] = "";
    await expect(scanTarget("http://localhost:3001")).rejects.toThrow(AuthorizationError);
  });

  it("allows an allowlisted URL", async () => {
    // All detectors get empty/safe responses → no findings
    mockFetch.mockResolvedValue({
      ok: true, status: 200,
      text: () => Promise.resolve("{}"),
      headers: { forEach: vi.fn() },
    });
    const result = await scanTarget("http://localhost:3001");
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("SQLi detector", () => {
  it("detects injection when probe returns more rows than benign", async () => {
    mockFetch.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes("helix_nosuchproduct")) {
        return makeFetchResponse(JSON.stringify({ products: [] }));
      }
      if (u.includes("OR") || u.includes("%27")) {
        return makeFetchResponse(JSON.stringify({
          products: [{ id: "1", name: "Widget" }, { id: "2", name: "Gadget" }],
          _debug_sql: "SELECT * FROM products WHERE name ILIKE '%' OR '1'='1%'",
        }));
      }
      return makeFetchResponse("{}");
    });

    const findings = await scanTarget("http://localhost:3001");
    expect(findings.some((f) => f.class === "SQLi")).toBe(true);
  });
});

describe("XSS detector", () => {
  it("detects reflected XSS when probe is in response unescaped", async () => {
    mockFetch.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes("search?q=")) {
        // Reflect the query param back unescaped
        const q = decodeURIComponent(u.split("q=")[1] ?? "");
        return makeFetchResponse(`<html><body>${q}</body></html>`);
      }
      return makeFetchResponse("{}");
    });

    const findings = await scanTarget("http://localhost:3001");
    expect(findings.some((f) => f.class === "XSS")).toBe(true);
  });
});

describe("secretLeak detector", () => {
  it("detects service key in JS bundle", async () => {
    mockFetch.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes("/search")) {
        return makeFetchResponse(
          `<html><script src="/_next/static/chunks/app/layout.js"></script></html>`,
        );
      }
      if (u.includes("layout.js")) {
        return makeFetchResponse(`var key="HELIX_DEMO_FAKE_KEY_DO_NOT_USE_IN_PRODUCTION"`);
      }
      return makeFetchResponse("{}");
    });

    const findings = await scanTarget("http://localhost:3001");
    expect(findings.some((f) => f.class === "secretLeak")).toBe(true);
  });
});
