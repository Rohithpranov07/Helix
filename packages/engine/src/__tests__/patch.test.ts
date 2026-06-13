import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError, type Vulnerability } from "@helix/shared";
import type { HelixDoc } from "@helix/db";

// Mock external deps before importing patch.ts
vi.mock("@helix/db", () => ({
  connectDb: vi.fn().mockResolvedValue(undefined),
  updateVulnerability: vi.fn().mockResolvedValue(null),
}));
vi.mock("@helix/ai", () => ({
  sarvam: {
    chat: vi.fn(),
  },
}));

import {
  synthesizePatch,
  applyInShadow,
  assertPatchSafe,
  type Patch,
  type ShadowApplier,
} from "../immune/patch.js";
import { sarvam } from "@helix/ai";
import { updateVulnerability } from "@helix/db";

function makeFinding(
  partial: Partial<Vulnerability> & { class: Vulnerability["class"] },
): HelixDoc<Vulnerability> {
  return {
    _id: "vuln-001",
    class: partial.class,
    endpoint: partial.endpoint ?? "/api/products/search",
    evidence: partial.evidence ?? "CONFIRMED SQLi differential: tautology 12 rows vs 0",
    reAttack: { before: "open", after: "open" },
    status: "open",
    detectedAt: new Date().toISOString(),
  };
}

const SQLI_PATCH: Patch = {
  files: [
    {
      path: "apps/target/src/app/api/products/search/route.ts",
      diff: "--- a/route.ts\n+++ b/route.ts\n@@\n-const sql = \"... '\" + q + \"'\";\n+const sql = 'SELECT ... WHERE name ILIKE $1';",
    },
  ],
  rationale: "Replace string-concatenated SQL with a parameterized query.",
};

beforeEach(() => {
  vi.mocked(sarvam.chat).mockReset();
  vi.mocked(updateVulnerability).mockClear();
});

// ── synthesizePatch ───────────────────────────────────────────────────────────

describe("synthesizePatch", () => {
  it("returns a Zod-valid patch from Sarvam JSON output", async () => {
    vi.mocked(sarvam.chat).mockResolvedValue({
      content: JSON.stringify(SQLI_PATCH),
      model: "sarvam-105b",
    });

    const finding = makeFinding({ class: "SQLi" });
    const patch = await synthesizePatch(finding);

    expect(patch.files).toHaveLength(1);
    expect(patch.files[0]!.path).toBe("apps/target/src/app/api/products/search/route.ts");
    expect(patch.rationale).toMatch(/parameterized/i);
  });

  it("sends the class-appropriate strategy in the prompt", async () => {
    vi.mocked(sarvam.chat).mockResolvedValue({
      content: JSON.stringify(SQLI_PATCH),
      model: "sarvam-105b",
    });

    await synthesizePatch(makeFinding({ class: "SQLi" }));

    const callArg = vi.mocked(sarvam.chat).mock.calls[0]![0];
    const userMsg = callArg.messages.find((m) => m.role === "user")!.content;
    expect(userMsg).toContain("SQLi");
    expect(userMsg).toContain("parameterized");
    expect(callArg.schema).toBeDefined();
  });

  it("rejects a patch that escapes the target app via path", async () => {
    vi.mocked(sarvam.chat).mockResolvedValue({
      content: JSON.stringify({
        files: [{ path: "packages/engine/src/index.ts", diff: "--- a\n+++ b\n@@\n-x\n+y" }],
        rationale: "malicious",
      }),
      model: "sarvam-105b",
    });

    await expect(synthesizePatch(makeFinding({ class: "SQLi" }))).rejects.toThrow(ValidationError);
  });
});

// ── assertPatchSafe ───────────────────────────────────────────────────────────

describe("assertPatchSafe", () => {
  it("accepts a patch fully inside apps/target/", () => {
    expect(() => assertPatchSafe(SQLI_PATCH)).not.toThrow();
  });

  it("rejects absolute paths", () => {
    expect(() =>
      assertPatchSafe({ files: [{ path: "/etc/passwd", diff: "x" }], rationale: "r" }),
    ).toThrow(ValidationError);
  });

  it("rejects path traversal with ..", () => {
    expect(() =>
      assertPatchSafe({ files: [{ path: "apps/target/../../secret", diff: "x" }], rationale: "r" }),
    ).toThrow(ValidationError);
  });

  it("rejects files outside apps/target/", () => {
    expect(() =>
      assertPatchSafe({ files: [{ path: "apps/web/app/page.tsx", diff: "x" }], rationale: "r" }),
    ).toThrow(ValidationError);
  });

  it("rejects patches exceeding the size threshold", () => {
    expect(() =>
      assertPatchSafe({
        files: [{ path: "apps/target/big.ts", diff: "x".repeat(20_001) }],
        rationale: "r",
      }),
    ).toThrow(ValidationError);
  });

  it("rejects patches touching too many files", () => {
    const files = Array.from({ length: 6 }, (_, i) => ({
      path: `apps/target/f${i}.ts`,
      diff: "x",
    }));
    expect(() => assertPatchSafe({ files, rationale: "r" })).toThrow(ValidationError);
  });
});

// ── applyInShadow ─────────────────────────────────────────────────────────────

describe("applyInShadow", () => {
  it("applies via the injected Shadow applier and records patchRef + status:patching", async () => {
    const applier: ShadowApplier = vi.fn().mockResolvedValue({
      patchRef: "shadow-change-abc123",
      shadowUrl: "http://localhost:3002",
    });

    const finding = makeFinding({ class: "SQLi" });
    const result = await applyInShadow(finding, SQLI_PATCH, applier);

    expect(applier).toHaveBeenCalledWith(SQLI_PATCH);
    expect(result.shadowUrl).toBe("http://localhost:3002");
    expect(updateVulnerability).toHaveBeenCalledWith("vuln-001", {
      status: "patching",
      patchRef: "shadow-change-abc123",
    });
  });

  it("throws (never touches real target) when no Shadow runtime is wired", async () => {
    const finding = makeFinding({ class: "SQLi" });
    // Default applier — T4.1 not built
    await expect(applyInShadow(finding, SQLI_PATCH)).rejects.toThrow(ValidationError);
    // No DB mutation should occur if application failed
    expect(updateVulnerability).not.toHaveBeenCalled();
  });

  it("rejects an unsafe patch before applying to the Shadow", async () => {
    const applier: ShadowApplier = vi.fn();
    const finding = makeFinding({ class: "SQLi" });
    const badPatch: Patch = {
      files: [{ path: "/etc/cron.d/evil", diff: "x" }],
      rationale: "r",
    };

    await expect(applyInShadow(finding, badPatch, applier)).rejects.toThrow(ValidationError);
    expect(applier).not.toHaveBeenCalled();
    expect(updateVulnerability).not.toHaveBeenCalled();
  });
});
