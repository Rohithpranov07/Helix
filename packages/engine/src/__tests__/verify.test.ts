import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "@helix/shared";
import type { ShadowProof } from "@helix/shared";
import type { HelixDoc } from "@helix/db";
import type { TrafficReplay } from "../shadow/runtime.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// vi.mock is hoisted — use vi.hoisted() for variables referenced in factory bodies.
const { mockGroqChat } = vi.hoisted(() => ({ mockGroqChat: vi.fn() }));

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue(
      JSON.stringify({
        findingId: "vuln-001",
        vulnClass: "SQLi",
        endpoint: "/api/products/search",
      }),
    ),
  };
});

vi.mock("@helix/db", () => ({
  connectDb: vi.fn().mockResolvedValue(undefined),
  createShadowProof: vi.fn(async (data: ShadowProof) => ({
    ...data,
    _id: "proof-mongo-001",
  })) as unknown as () => Promise<HelixDoc<ShadowProof>>,
}));

vi.mock("@helix/ai", () => ({
  groq: { chat: mockGroqChat },
}));

// Mock replayTraffic from runtime — we don't want real HTTP calls
vi.mock("../shadow/runtime.js", () => ({
  replayTraffic: vi.fn(),
  SHADOW_URL: "http://localhost:3002",
  TARGET_URL: "http://localhost:3001",
}));

import { verifyEquivalence } from "../shadow/verify.js";
import { createShadowProof } from "@helix/db";
import { replayTraffic } from "../shadow/runtime.js";
import { existsSync, readFileSync } from "fs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReplay(
  path: string,
  realStatus: number,
  shadowStatus: number,
  shadowBody = "",
  realBody = "",
): TrafficReplay {
  return {
    case: { method: "GET", path },
    real: { status: realStatus, body: realBody, durationMs: 10 },
    shadow: { status: shadowStatus, body: shadowBody, durationMs: 12 },
  };
}

function groqRespond(intendedFixPassed: boolean, regressions: number): void {
  mockGroqChat.mockResolvedValueOnce({
    content: JSON.stringify({
      intendedFixPassed,
      regressions,
      rationale: "Groq says so.",
    }),
    model: "qwen3.6-27b",
  });
}

beforeEach(() => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readFileSync).mockReturnValue(
    JSON.stringify({ findingId: "vuln-001", vulnClass: "SQLi", endpoint: "/api/products/search" }),
  );
  mockGroqChat.mockClear();
  vi.mocked(createShadowProof).mockClear();
  vi.mocked(replayTraffic).mockClear();
  vi.mocked(replayTraffic).mockResolvedValue([
    makeReplay("/api/products/search?q=%27+OR+%271%27%3D%271", 200, 200, '{"products":[]}'),
    makeReplay("/api/products/search?q=helix_nomatch_xyz", 200, 200, '{"products":[]}'),
  ]);
});

// ── verifyEquivalence — happy path ────────────────────────────────────────────

describe("verifyEquivalence — happy path (Groq promotes)", () => {
  it("returns a ShadowProof with verdict=promote when Groq says fix passed", async () => {
    groqRespond(true, 0);

    const proof = await verifyEquivalence("shadow-123-abc");

    expect(proof.verdict).toBe("promote");
    expect(proof.intendedFixPassed).toBe(true);
    expect(proof.regressions).toBe(0);
    expect(proof.changeRef).toBe("shadow-123-abc");
    expect(proof.replayedCases).toBe(2);
    expect(proof.proofId).toMatch(/^proof-\d+-[a-z0-9]+$/);
    expect(proof.verifiedAt).toBeTruthy();
  });

  it("persists the proof to MongoDB via createShadowProof", async () => {
    groqRespond(true, 0);

    await verifyEquivalence("shadow-123-abc");

    expect(createShadowProof).toHaveBeenCalledOnce();
    const call = vi.mocked(createShadowProof).mock.calls[0]![0];
    expect(call.verdict).toBe("promote");
    expect(call.changeRef).toBe("shadow-123-abc");
  });

  it("returns verdict=reject when Groq says fix failed", async () => {
    groqRespond(false, 0);

    const proof = await verifyEquivalence("shadow-123-abc");

    expect(proof.verdict).toBe("reject");
    expect(proof.intendedFixPassed).toBe(false);
  });

  it("returns verdict=reject when regressions > 0 even if intendedFixPassed", async () => {
    groqRespond(true, 2);

    const proof = await verifyEquivalence("shadow-123-abc");

    expect(proof.verdict).toBe("reject");
    expect(proof.regressions).toBe(2);
  });
});

// ── verifyEquivalence — traffic replay ────────────────────────────────────────

describe("verifyEquivalence — traffic replay", () => {
  it("calls replayTraffic with the correct cases for SQLi", async () => {
    groqRespond(true, 0);

    await verifyEquivalence("shadow-123-abc");

    expect(replayTraffic).toHaveBeenCalledOnce();
    const cases = vi.mocked(replayTraffic).mock.calls[0]![0];
    // SQLi attack case: tautology
    expect(cases.some((c) => c.path.includes("%27+OR+%271%27%3D%271"))).toBe(true);
    // SQLi benign case: nomatch
    expect(cases.some((c) => c.path.includes("helix_nomatch_xyz"))).toBe(true);
  });

  it("calls replayTraffic with XSS attack case when meta says XSS", async () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ findingId: "vuln-002", vulnClass: "XSS", endpoint: "/search" }),
    );
    groqRespond(true, 0);

    await verifyEquivalence("shadow-456-xss");

    const cases = vi.mocked(replayTraffic).mock.calls[0]![0];
    expect(cases.some((c) => c.path.includes("script"))).toBe(true);
  });

  it("calls replayTraffic with authBypass case for authBypass class", async () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ findingId: "vuln-003", vulnClass: "authBypass", endpoint: "/admin/orders" }),
    );
    groqRespond(true, 0);

    await verifyEquivalence("shadow-789-auth");

    const cases = vi.mocked(replayTraffic).mock.calls[0]![0];
    expect(cases.some((c) => c.path === "/admin/orders")).toBe(true);
  });
});

// ── verifyEquivalence — Groq fallback (deterministic) ───────────────────────

describe("verifyEquivalence — deterministic fallback", () => {
  it("falls back to deterministic check when Groq throws", async () => {
    mockGroqChat.mockRejectedValueOnce(new Error("Groq unavailable"));
    // SQLi: shadow returns 400 for tautology → fix passed deterministically
    vi.mocked(replayTraffic).mockResolvedValueOnce([
      makeReplay("/api/products/search?q=tautology", 200, 400, "Bad request"),
      makeReplay("/api/products/search?q=nomatch", 200, 200, '{"products":[]}'),
    ]);

    const proof = await verifyEquivalence("shadow-123-abc");

    expect(proof.verdict).toBe("promote");
    expect(proof.intendedFixPassed).toBe(true);
  });

  it("deterministic: XSS fix — shadow response does not contain raw <script> tag", async () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ findingId: "v", vulnClass: "XSS", endpoint: "/search" }),
    );
    mockGroqChat.mockRejectedValueOnce(new Error("unavailable"));
    vi.mocked(replayTraffic).mockResolvedValueOnce([
      makeReplay("/search?q=xss", 200, 200, "<p>escaped</p>"),
      makeReplay("/search?q=normal", 200, 200, "<p>products</p>"),
    ]);

    const proof = await verifyEquivalence("shadow-xss-abc");

    expect(proof.intendedFixPassed).toBe(true);
  });

  it("deterministic: XSS NOT fixed — shadow still reflects <script> verbatim", async () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ findingId: "v", vulnClass: "XSS", endpoint: "/search" }),
    );
    mockGroqChat.mockRejectedValueOnce(new Error("unavailable"));
    vi.mocked(replayTraffic).mockResolvedValueOnce([
      makeReplay("/search?q=xss", 200, 200, "<script>alert(1)</script>"),
    ]);

    const proof = await verifyEquivalence("shadow-xss-bad");

    expect(proof.intendedFixPassed).toBe(false);
    expect(proof.verdict).toBe("reject");
  });

  it("deterministic: authBypass fixed — shadow returns 403", async () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ findingId: "v", vulnClass: "authBypass", endpoint: "/admin/orders" }),
    );
    mockGroqChat.mockRejectedValueOnce(new Error("unavailable"));
    vi.mocked(replayTraffic).mockResolvedValueOnce([
      makeReplay("/admin/orders", 200, 403, "Forbidden"),
    ]);

    const proof = await verifyEquivalence("shadow-auth-abc");

    expect(proof.intendedFixPassed).toBe(true);
    expect(proof.verdict).toBe("promote");
  });

  it("deterministic: regression counted when real=200 but shadow=500", async () => {
    mockGroqChat.mockRejectedValueOnce(new Error("unavailable"));
    vi.mocked(replayTraffic).mockResolvedValueOnce([
      makeReplay("/api/products/search?q=tautology", 200, 400, "Bad request"), // attack fixed
      makeReplay("/api/products/search?q=normal", 200, 500, "Internal error"), // regression!
    ]);

    const proof = await verifyEquivalence("shadow-reg-abc");

    expect(proof.regressions).toBe(1);
    expect(proof.verdict).toBe("reject"); // regressions > 0 → reject even if fix passed
  });
});

// ── verifyEquivalence — meta errors ──────────────────────────────────────────

describe("verifyEquivalence — staging meta errors", () => {
  it("throws ValidationError when meta.json does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const err = await verifyEquivalence("shadow-missing").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toContain("meta not found");
  });

  it("throws ValidationError when meta.json has an invalid schema", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValueOnce(
      JSON.stringify({ findingId: "v", vulnClass: "UNKNOWN_CLASS", endpoint: "/" }),
    );

    const err = await verifyEquivalence("shadow-bad-meta").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
  });
});
