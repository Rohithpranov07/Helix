import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "@helix/shared";
import type { Vulnerability } from "@helix/shared";
import type { HelixDoc } from "@helix/db";
import type { Patch } from "../immune/patch.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("child_process", () => ({
  spawnSync: vi.fn().mockReturnValue({ status: 0, stdout: "", stderr: "" }),
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

// assertPatchSafe is called inside promoteToTarget — let it run real logic
// so we verify the guard fires. Mock it only for specific tests.
vi.mock("../immune/patch.js", async () => {
  const actual = await vi.importActual<typeof import("../immune/patch.js")>("../immune/patch.js");
  return { ...actual };
});

import { spawnSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { promoteToTarget } from "../immune/promote.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFinding(overrides: Partial<Vulnerability> = {}): HelixDoc<Vulnerability> {
  return {
    _id: "vuln-001",
    class: "SQLi",
    endpoint: "/api/products/search",
    evidence: "CONFIRMED: tautology returned all rows.",
    detectedAt: new Date().toISOString(),
    status: "open",
    ...overrides,
  } as HelixDoc<Vulnerability>;
}

function makePatch(overrides: Partial<Patch> = {}): Patch {
  return {
    files: [
      {
        path: "apps/target/src/app/api/products/search/route.ts",
        diff: `--- a/apps/target/src/app/api/products/search/route.ts
+++ b/apps/target/src/app/api/products/search/route.ts
@@ -10,5 +10,5 @@
-  const sql = \`SELECT * WHERE name LIKE '%\${q}%'\`;
+  const sql = \`SELECT * WHERE name LIKE $1\`;
`,
      },
    ],
    rationale: "Parameterize the SQL query.",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(spawnSync).mockClear();
  vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: "", stderr: "" } as ReturnType<typeof spawnSync>);
  vi.mocked(mkdirSync).mockClear();
  vi.mocked(writeFileSync).mockClear();
});

// ── promoteToTarget — happy path ──────────────────────────────────────────────

describe("promoteToTarget — happy path", () => {
  it("applies each patch file to the real target via `patch -p1`", async () => {
    await promoteToTarget(makeFinding(), makePatch());

    const patchCall = vi.mocked(spawnSync).mock.calls.find((c) => c[0] === "patch");
    expect(patchCall).toBeDefined();
    const args = patchCall![1] as string[];
    expect(args).toContain("-p1");
    expect(args).toContain("--no-backup-if-mismatch");
    expect(args).toContain("-i");
  });

  it("runs patch from REPO_ROOT (not shadow/workspace)", async () => {
    await promoteToTarget(makeFinding(), makePatch());

    const patchCall = vi.mocked(spawnSync).mock.calls.find((c) => c[0] === "patch");
    const opts = patchCall![2] as { cwd?: string };
    // Must NOT be shadow/workspace; must be the repo root (no "shadow" in cwd)
    expect(opts.cwd).toBeDefined();
    expect(opts.cwd).not.toContain("shadow/workspace");
    // cwd ends with the repo name (Helix) or is the repo root
    expect(opts.cwd).toMatch(/Helix\/?$/);
  });

  it("writes each diff to shadow/staging for audit trail", async () => {
    await promoteToTarget(makeFinding(), makePatch());

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("shadow/staging"),
      expect.stringContaining("@@ -10,5 +10,5 @@"),
      "utf8",
    );
    expect(mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining("shadow/staging"),
      { recursive: true },
    );
  });

  it("handles multiple files in a single patch", async () => {
    const patch = makePatch({
      files: [
        { path: "apps/target/src/app/api/products/search/route.ts", diff: "diff1" },
        { path: "apps/target/src/lib/adminClient.ts", diff: "diff2" },
      ],
    });

    await promoteToTarget(makeFinding(), patch);

    const patchCalls = vi.mocked(spawnSync).mock.calls.filter((c) => c[0] === "patch");
    expect(patchCalls).toHaveLength(2);
  });

  it("resolves without returning a value", async () => {
    const result = await promoteToTarget(makeFinding(), makePatch());
    expect(result).toBeUndefined();
  });
});

// ── promoteToTarget — safety guards ──────────────────────────────────────────

describe("promoteToTarget — safety guards", () => {
  it("throws ValidationError when patch command exits non-zero", async () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "FAILED: patch offset mismatch at line 10",
      stderr: "",
    } as ReturnType<typeof spawnSync>);

    const err = await promoteToTarget(makeFinding(), makePatch()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toContain("patch command failed");
    expect((err as ValidationError).message).toContain("apps/target/src");
  });

  it("throws ValidationError when patch path escapes apps/target/", async () => {
    const badPatch = makePatch({
      files: [{ path: "../../packages/shared/src/types.ts", diff: "bad diff" }],
    });

    const err = await promoteToTarget(makeFinding(), badPatch).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    // assertPatchSafe fires before any system call
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("throws ValidationError when patch has an absolute path", async () => {
    const badPatch = makePatch({
      files: [{ path: "/etc/passwd", diff: "bad diff" }],
    });

    const err = await promoteToTarget(makeFinding(), badPatch).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("does NOT call spawnSync at all when assertPatchSafe throws", async () => {
    const badPatch = makePatch({ files: [] }); // empty files also fails assertPatchSafe

    await promoteToTarget(makeFinding(), badPatch).catch(() => null);

    expect(spawnSync).not.toHaveBeenCalled();
  });
});

// ── promoteToTarget — audit-trail promoRef uniqueness ────────────────────────

describe("promoteToTarget — audit staging", () => {
  it("each call creates a unique promote-<ts>-<rand> staging subdirectory", async () => {
    await promoteToTarget(makeFinding(), makePatch());
    await promoteToTarget(makeFinding(), makePatch());

    const mkdirCalls = vi.mocked(mkdirSync).mock.calls.map((c) => c[0] as string);
    const promoteRefs = mkdirCalls.filter((p) => p.includes("promote-"));
    expect(promoteRefs).toHaveLength(2);
    expect(new Set(promoteRefs).size).toBe(2); // unique refs
  });
});
