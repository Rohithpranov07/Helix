import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "@helix/shared";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("child_process", () => ({
  spawnSync: vi.fn().mockReturnValue({ status: 0, stdout: "", stderr: "" }),
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    copyFileSync: vi.fn(),
    cpSync: vi.fn(),
  };
});

// Mock fetch globally for spinShadow health check and replayTraffic
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock assertPatchSafe to be a no-op in most tests
vi.mock("../immune/patch.js", () => ({
  assertPatchSafe: vi.fn(),
}));

import { spawnSync } from "child_process";
import { existsSync, copyFileSync, cpSync, mkdirSync, writeFileSync } from "fs";
import { spinShadow, applyToShadow, replayTraffic } from "../shadow/runtime.js";
import { assertPatchSafe } from "../immune/patch.js";
import type { Patch } from "../immune/patch.js";

function makePatch(overrides: Partial<Patch> = {}): Patch {
  return {
    files: [
      {
        path: "apps/target/src/app/api/products/search/route.ts",
        diff: `--- a/apps/target/src/app/api/products/search/route.ts
+++ b/apps/target/src/app/api/products/search/route.ts
@@ -10,5 +10,5 @@
-  const query = \`SELECT * FROM products WHERE name LIKE '%\${q}%'\`;
+  const query = \`SELECT * FROM products WHERE name LIKE $1\`;
`,
      },
    ],
    rationale: "Fix SQLi by using parameterized query.",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(spawnSync).mockClear();
  vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: "", stderr: "" } as ReturnType<typeof spawnSync>);
  vi.mocked(existsSync).mockClear();
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(assertPatchSafe).mockClear();
  vi.mocked(assertPatchSafe).mockImplementation(() => undefined);
  mockFetch.mockClear();
  vi.mocked(cpSync).mockClear();
  vi.mocked(copyFileSync).mockClear();
  vi.mocked(mkdirSync).mockClear();
  vi.mocked(writeFileSync).mockClear();
});

// ── spinShadow ────────────────────────────────────────────────────────────────

describe("spinShadow — happy path", () => {
  beforeEach(() => {
    // Shadow workspace already exists — no cpSync needed
    vi.mocked(existsSync).mockReturnValue(true);
    // First fetch call = health check passes immediately
    mockFetch.mockResolvedValue({ status: 200 });
  });

  it("starts the shadow container via docker compose", async () => {
    await spinShadow();

    const dockerCall = vi.mocked(spawnSync).mock.calls.find(
      (c) => c[0] === "docker",
    );
    expect(dockerCall).toBeDefined();
    const args = dockerCall![1] as string[];
    expect(args).toContain("up");
    expect(args).toContain("-d");
    expect(args).toContain("--build");
  });

  it("returns the shadow URL", async () => {
    const { shadowUrl } = await spinShadow();
    expect(shadowUrl).toBe("http://localhost:3002");
  });

  it("accepts a custom shadowUrl override", async () => {
    const { shadowUrl } = await spinShadow({ shadowUrl: "http://localhost:9002" });
    expect(shadowUrl).toBe("http://localhost:9002");
  });

  it("does NOT cpSync when workspace/src already exists", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    await spinShadow();
    expect(cpSync).not.toHaveBeenCalled();
  });

  it("cpSync from real target when workspace/src is missing", async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    // Health check still needs to resolve
    mockFetch.mockResolvedValue({ status: 200 });
    // docker compose also must succeed
    vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: "", stderr: "" } as ReturnType<typeof spawnSync>);

    await spinShadow();

    expect(cpSync).toHaveBeenCalledWith(
      expect.stringContaining("apps/target/src"),
      expect.stringContaining("shadow/workspace/apps/target/src"),
      { recursive: true },
    );
  });
});

describe("spinShadow — docker compose failure", () => {
  it("throws ValidationError when docker compose exits non-zero", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "Cannot connect to Docker daemon",
    } as ReturnType<typeof spawnSync>);

    const err = await spinShadow().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toContain("docker compose");
  });
});

// ── applyToShadow — happy path ────────────────────────────────────────────────

describe("applyToShadow — happy path", () => {
  it("returns a patchRef and the shadow URL", async () => {
    const result = await applyToShadow(makePatch());

    expect(result.patchRef).toMatch(/^shadow-\d+-[a-z0-9]+$/);
    expect(result.shadowUrl).toBe("http://localhost:3002");
  });

  it("calls assertPatchSafe for defence-in-depth", async () => {
    await applyToShadow(makePatch());
    expect(assertPatchSafe).toHaveBeenCalledTimes(1);
  });

  it("writes each diff to a staging audit file", async () => {
    await applyToShadow(makePatch());

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("shadow/staging"),
      expect.stringContaining("@@ -10,5 +10,5 @@"),
      "utf8",
    );
  });

  it("invokes patch -p1 with the staging diff file", async () => {
    await applyToShadow(makePatch());

    const patchCall = vi.mocked(spawnSync).mock.calls.find(
      (c) => c[0] === "patch",
    );
    expect(patchCall).toBeDefined();
    const args = patchCall![1] as string[];
    expect(args).toContain("-p1");
    expect(args).toContain("--no-backup-if-mismatch");
    expect(args).toContain("-i");
    // cwd must be SHADOW_WORKSPACE
    const opts = patchCall![2] as { cwd?: string };
    expect(opts.cwd).toContain("shadow/workspace");
  });

  it("does NOT touch apps/target (real target) source", async () => {
    await applyToShadow(makePatch());

    // writeFileSync should only write to shadow paths
    for (const call of vi.mocked(writeFileSync).mock.calls) {
      const filePath = call[0] as string;
      expect(filePath).not.toMatch(/apps\/target\/src\//);
    }
  });

  it("handles multiple files in a single patch", async () => {
    const patch = makePatch({
      files: [
        { path: "apps/target/src/app/api/products/search/route.ts", diff: "diff1" },
        { path: "apps/target/src/lib/adminClient.ts", diff: "diff2" },
      ],
    });

    await applyToShadow(patch);

    const patchCalls = vi.mocked(spawnSync).mock.calls.filter((c) => c[0] === "patch");
    expect(patchCalls).toHaveLength(2);
  });
});

describe("applyToShadow — file not in workspace", () => {
  it("copies from real target when workspace file is missing", async () => {
    // existsSync: workspace file missing, but real target file exists
    vi.mocked(existsSync)
      .mockReturnValueOnce(false) // workspace file check → missing
      .mockReturnValueOnce(true); // real target file check → exists

    await applyToShadow(makePatch());

    expect(copyFileSync).toHaveBeenCalledWith(
      expect.stringContaining("apps/target/src"),
      expect.stringContaining("shadow/workspace/apps/target/src"),
    );
  });

  it("throws ValidationError when both workspace AND real target file are missing", async () => {
    vi.mocked(existsSync).mockReturnValue(false); // both missing

    await expect(applyToShadow(makePatch())).rejects.toThrow(ValidationError);
    await expect(applyToShadow(makePatch())).rejects.toThrow("source file not found");
  });
});

describe("applyToShadow — patch command failure", () => {
  it("throws ValidationError when patch exits non-zero", async () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "FAILED: patch offset mismatch",
      stderr: "",
    } as ReturnType<typeof spawnSync>);

    const err = await applyToShadow(makePatch()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toContain("patch command failed");
  });
});

// ── replayTraffic ─────────────────────────────────────────────────────────────

describe("replayTraffic — happy path", () => {
  it("fans requests to real target and shadow in parallel and returns pairs", async () => {
    mockFetch
      .mockResolvedValueOnce({ status: 200, text: async () => '{"products":[]}' })
      .mockResolvedValueOnce({ status: 200, text: async () => '{"products":[]}' });

    const results = await replayTraffic(
      [{ method: "GET", path: "/api/products/search?q=test" }],
      { targetUrl: "http://localhost:3001", shadowUrl: "http://localhost:3002" },
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.real.status).toBe(200);
    expect(results[0]!.shadow.status).toBe(200);
    expect(results[0]!.case.path).toBe("/api/products/search?q=test");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("sends request to the correct target and shadow URLs", async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => "ok" });

    await replayTraffic(
      [{ method: "GET", path: "/search" }],
      { targetUrl: "http://real:3001", shadowUrl: "http://shadow:3002" },
    );

    const urls = vi.mocked(mockFetch).mock.calls.map((c) => c[0] as string);
    expect(urls).toContain("http://real:3001/search");
    expect(urls).toContain("http://shadow:3002/search");
  });

  it("handles POST with body correctly", async () => {
    mockFetch.mockResolvedValue({ status: 201, text: async () => '{"ok":true}' });

    await replayTraffic(
      [{ method: "POST", path: "/api/order", body: { item: "chair" } }],
    );

    const callBody = vi.mocked(mockFetch).mock.calls[0]![1] as RequestInit;
    expect(callBody.method).toBe("POST");
    expect(callBody.body).toBe('{"item":"chair"}');
  });

  it("returns status 0 when fetch throws (network error)", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const results = await replayTraffic(
      [{ method: "GET", path: "/api/products/search" }],
    );

    expect(results[0]!.real.status).toBe(0);
    expect(results[0]!.real.body).toContain("ECONNREFUSED");
  });

  it("handles multiple cases in sequence", async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => "" });

    const results = await replayTraffic([
      { method: "GET", path: "/api/products/search" },
      { method: "GET", path: "/search" },
      { method: "POST", path: "/api/cart", body: {} },
    ]);

    expect(results).toHaveLength(3);
    // 3 cases × 2 urls = 6 total fetch calls
    expect(mockFetch).toHaveBeenCalledTimes(6);
  });
});
