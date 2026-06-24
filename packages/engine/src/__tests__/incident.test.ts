import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Incident } from "@helix/shared";
import type { HelixDoc } from "@helix/db";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockGroqChat, mockGeminiAnalyze } = vi.hoisted(() => ({
  mockGroqChat: vi.fn(),
  mockGeminiAnalyze: vi.fn(),
}));

vi.mock("@helix/ai", () => ({
  groq: { chat: mockGroqChat },
  gemini: { analyze: mockGeminiAnalyze },
}));

vi.mock("@helix/db", () => ({
  connectDb: vi.fn().mockResolvedValue(undefined),
  createIncident: vi.fn(async (data: Incident) => ({
    ...data,
    _id: "inc-mongo-001",
  })) as unknown as () => Promise<HelixDoc<Incident>>,
}));

import { handleIncident } from "../nervous/incident.js";
import { createIncident } from "@helix/db";

// ── Helpers ───────────────────────────────────────────────────────────────────

function goodCausalResponse(steps = 3) {
  return JSON.stringify({
    causalChain: Array.from({ length: steps }, (_, i) => ({
      order: i + 1,
      description: `Step ${i + 1}: something went wrong`,
      evidenceRef: `status:500`,
    })),
    rollbackRecommended: true,
    userImpactSeconds: 120,
  });
}

function groqOk(steps = 3): void {
  mockGroqChat.mockResolvedValueOnce({ content: goodCausalResponse(steps), model: "qwen3.6-27b" });
}

beforeEach(() => {
  mockGroqChat.mockClear();
  mockGeminiAnalyze.mockClear();
  vi.mocked(createIncident).mockClear();
  // Default: Gemini unavailable (short-circuit; tests explicitly enable it)
  mockGeminiAnalyze.mockRejectedValue(new Error("Gemini unavailable"));
});

// ── handleIncident — happy path ───────────────────────────────────────────────

describe("handleIncident — happy path", () => {
  it("persists an Incident to MongoDB and returns it", async () => {
    groqOk();

    const doc = await handleIncident({
      deployId: "deploy-abc",
      signal: { url: "/api/products", status: 500, latencyMs: 2000 },
    });

    expect(doc.incidentId).toMatch(/^inc-\d+-[a-z0-9]+$/);
    expect(doc.deployId).toBe("deploy-abc");
    expect(doc.detectedAt).toBeTruthy();
    expect(doc.causalChain).toHaveLength(3);
    expect(doc.userImpactSeconds).toBe(120);
    expect(createIncident).toHaveBeenCalledOnce();
  });

  it("sets baselineDelta from latencyMs - baselineLatencyMs", async () => {
    groqOk();

    const doc = await handleIncident({
      deployId: "deploy-abc",
      signal: { latencyMs: 900, baselineLatencyMs: 150 },
    });

    expect(doc.baselineDelta).toBe(750);
  });

  it("infers baselineDelta from HTTP 5xx status when no latency given", async () => {
    groqOk();

    const doc = await handleIncident({
      deployId: "deploy-abc",
      signal: { status: 503 },
    });

    expect(doc.baselineDelta).toBe(5000);
  });

  it("uses latency vs default baseline (150ms) when baselineLatencyMs absent", async () => {
    groqOk();

    const doc = await handleIncident({
      deployId: "deploy-abc",
      signal: { latencyMs: 600 },
    });

    expect(doc.baselineDelta).toBe(450);
  });

  it("sets rollbackAt when Groq recommends rollback", async () => {
    groqOk();

    const doc = await handleIncident({
      deployId: "deploy-abc",
      signal: { status: 500 },
    });

    expect(doc.rollbackAt).toBeTruthy();
  });

  it("does NOT set rollbackAt when Groq says no rollback", async () => {
    mockGroqChat.mockResolvedValueOnce({
      content: JSON.stringify({
        causalChain: [{ order: 1, description: "Minor regression", evidenceRef: "status:200" }],
        rollbackRecommended: false,
        userImpactSeconds: 10,
      }),
      model: "qwen3.6-27b",
    });

    const doc = await handleIncident({
      deployId: "deploy-abc",
      signal: { latencyMs: 200, baselineLatencyMs: 150 },
    });

    expect(doc.rollbackAt).toBeUndefined();
  });

  it("stores the raw signal as failingRequest", async () => {
    groqOk();
    const signal = { url: "/api/products", status: 500, customField: "x" };

    const doc = await handleIncident({ deployId: "deploy-abc", signal });

    expect(doc.failingRequest).toEqual(signal);
  });
});

// ── handleIncident — Groq causal chain ──────────────────────────────────────

describe("handleIncident — Groq causal chain", () => {
  it("passes deployId and signal fields into the Groq prompt", async () => {
    groqOk();

    await handleIncident({
      deployId: "deploy-xyz",
      signal: { url: "/checkout", status: 502, latencyMs: 8000 },
    });

    const call = mockGroqChat.mock.calls[0]![0];
    const userMsg = call.messages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMsg).toContain("deploy-xyz");
    expect(userMsg).toContain("502");
    expect(userMsg).toContain("/checkout");
    expect(userMsg).toContain("8000");
  });

  it("includes parsedLog summary in prompt when Gemini returns a summary", async () => {
    groqOk();
    mockGeminiAnalyze.mockResolvedValueOnce({ content: "Gemini summary: NullPointerException at line 42." });

    await handleIncident({
      deployId: "deploy-abc",
      // Long log triggers Gemini (>300 chars)
      signal: { log: "A".repeat(400) },
    });

    const call = mockGroqChat.mock.calls[0]![0];
    const userMsg = call.messages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMsg).toContain("Gemini summary");
  });

  it("does NOT call Gemini when signal has no long text", async () => {
    groqOk();

    await handleIncident({
      deployId: "deploy-abc",
      signal: { status: 500, latencyMs: 300 },
    });

    expect(mockGeminiAnalyze).not.toHaveBeenCalled();
  });

  it("causalChain entries have correct shape", async () => {
    groqOk(4);

    const doc = await handleIncident({
      deployId: "deploy-abc",
      signal: { status: 500 },
    });

    expect(doc.causalChain).toHaveLength(4);
    for (const step of doc.causalChain) {
      expect(typeof step.order).toBe("number");
      expect(typeof step.description).toBe("string");
      expect(typeof step.evidenceRef).toBe("string");
    }
  });
});

// ── handleIncident — deterministic fallback ───────────────────────────────────

describe("handleIncident — deterministic fallback (Groq unavailable)", () => {
  it("falls back gracefully and still returns a valid Incident", async () => {
    mockGroqChat.mockRejectedValueOnce(new Error("Groq down"));

    const doc = await handleIncident({
      deployId: "deploy-abc",
      signal: { status: 500 },
    });

    expect(doc.causalChain.length).toBeGreaterThanOrEqual(1);
    expect(doc.deployId).toBe("deploy-abc");
    expect(createIncident).toHaveBeenCalledOnce();
  });

  it("fallback includes HTTP 500 evidence in causal chain", async () => {
    mockGroqChat.mockRejectedValueOnce(new Error("Groq down"));

    const doc = await handleIncident({
      deployId: "deploy-abc",
      signal: { status: 503 },
    });

    const descriptions = doc.causalChain.map((s) => s.description).join(" ");
    expect(descriptions).toContain("503");
  });

  it("fallback recommends rollback on HTTP 5xx", async () => {
    mockGroqChat.mockRejectedValueOnce(new Error("down"));

    const doc = await handleIncident({
      deployId: "deploy-abc",
      signal: { status: 500 },
    });

    expect(doc.rollbackAt).toBeTruthy();
  });

  it("fallback: no rollback for low baselineDelta", async () => {
    mockGroqChat.mockRejectedValueOnce(new Error("down"));

    const doc = await handleIncident({
      deployId: "deploy-abc",
      signal: { latencyMs: 200, baselineLatencyMs: 180 },
    });

    expect(doc.rollbackAt).toBeUndefined();
  });
});

// ── handleIncident — signal shapes ───────────────────────────────────────────

describe("handleIncident — signal parsing", () => {
  it("accepts a raw string as the signal", async () => {
    groqOk();

    const doc = await handleIncident({
      deployId: "deploy-abc",
      signal: "Error: ECONNREFUSED connecting to database",
    });

    expect(doc.causalChain.length).toBeGreaterThan(0);
    expect(doc.failingRequest).toBe("Error: ECONNREFUSED connecting to database");
  });

  it("accepts an unknown shape gracefully", async () => {
    groqOk();

    const doc = await handleIncident({
      deployId: "deploy-abc",
      signal: { weirdField: true, nested: { x: 1 } },
    });

    expect(doc).toBeDefined();
  });

  it("baselineDelta is 0 when no latency or status information", async () => {
    groqOk();

    const doc = await handleIncident({
      deployId: "deploy-abc",
      signal: { message: "deploy complete" },
    });

    expect(doc.baselineDelta).toBe(0);
  });
});
