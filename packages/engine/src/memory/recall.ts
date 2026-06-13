/**
 * T3.2 — Vector recall + recurrence blocking
 *
 * matchAntibody: given a signature string or a pre-computed embedding vector,
 *   find near-matching antibodies via MongoDB Atlas $vectorSearch (cosine).
 *   Falls back to in-memory cosine similarity when Atlas vector search index is
 *   unavailable (local development, CI without Atlas).
 *
 * blockRecurrence: runs every minted regression test against the live target app.
 *   Any test failure means the vulnerability has recurred — increments
 *   recurrencesBlocked on the affected antibody and returns a structured report
 *   with a non-zero exit code suitable for CI gating.
 *
 * Atlas index required for matchAntibody (vector path):
 *   collection: antibody
 *   index name: antibody_embedding_idx
 *   field: embedding  (vector, 1536 dims, cosine similarity)
 *   Create in Atlas UI → Search → Create Search Index → JSON editor:
 *   { "fields": [{ "type": "vector", "path": "embedding",
 *                  "numDimensions": 1536, "similarity": "cosine" }] }
 */
import { spawnSync } from "child_process";
import { readdirSync, existsSync } from "fs";
import { resolve, basename } from "path";
import { ValidationError, type Antibody } from "@helix/shared";
import { embed } from "@helix/ai";
import {
  connectDb,
  listAntibodies,
  updateAntibody,
  AntibodyModel,
} from "@helix/db";
import type { HelixDoc } from "@helix/db";

// ── Constants ─────────────────────────────────────────────────────────────────

const VECTOR_INDEX = "antibody_embedding_idx";
const REPO_ROOT = resolve(__dirname, "../../../..");
const ANTIBODY_TEST_DIR = resolve(REPO_ROOT, "apps/target/src/__tests__/antibodies");
const VITEST_BIN = resolve(__dirname, "../../node_modules/.bin/vitest");

// ── Cosine similarity (in-memory fallback) ────────────────────────────────────

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) ** 2;
    normB += (b[i] ?? 0) ** 2;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Atlas $vectorSearch ───────────────────────────────────────────────────────

export interface AntibodyMatch {
  antibody: HelixDoc<Antibody>;
  score: number;
  /** How the match was found. */
  matchType: "exact" | "vector-atlas" | "vector-cosine";
}

async function atlasVectorSearch(
  queryVector: number[],
  limit: number,
): Promise<AntibodyMatch[]> {
  // $vectorSearch requires a pre-created Atlas Search index named VECTOR_INDEX.
  // The score is exposed via { $meta: "vectorSearchScore" } in $project.
  const raw = await AntibodyModel.aggregate<Record<string, unknown>>([
    {
      $vectorSearch: {
        index: VECTOR_INDEX,
        path: "embedding",
        queryVector,
        numCandidates: Math.max(limit * 20, 150),
        limit,
      },
    },
    {
      $project: {
        _id: 1,
        antibodyId: 1,
        sourceType: 1,
        signature: 1,
        embedding: 1,
        regressionTest: 1,
        runtimeAssertion: 1,
        mintedAt: 1,
        recurrencesBlocked: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  return raw.map((r) => ({
    antibody: {
      ...(r as unknown as Antibody),
      _id: String(r["_id"]),
    } as HelixDoc<Antibody>,
    score: Number(r["score"] ?? 0),
    matchType: "vector-atlas" as const,
  }));
}

async function cosineSearch(
  queryVector: number[],
  limit: number,
): Promise<AntibodyMatch[]> {
  const all = await listAntibodies();
  return all
    .map((ab) => ({
      antibody: ab,
      score: cosine(queryVector, ab.embedding),
      matchType: "vector-cosine" as const,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ── matchAntibody ─────────────────────────────────────────────────────────────

/**
 * Finds antibodies near a given signature string or pre-computed embedding.
 *
 * - Exact string of 16 hex chars → tries signature field lookup first (score 1.0).
 * - Any other string → computes embedding then vector searches.
 * - number[] → direct vector search.
 *
 * Tries Atlas $vectorSearch first; falls back to in-memory cosine similarity
 * when the Atlas index is unavailable.
 */
export async function matchAntibody(
  input: string | number[],
  limit = 5,
): Promise<AntibodyMatch[]> {
  await connectDb();

  // Exact signature match (16-hex string)
  if (typeof input === "string" && /^[0-9a-f]{16}$/.test(input)) {
    const all = await listAntibodies({ signature: input } as Partial<Antibody>);
    if (all.length > 0) {
      return all.map((ab) => ({ antibody: ab, score: 1.0, matchType: "exact" as const }));
    }
  }

  // Compute query vector
  let queryVector: number[];
  if (typeof input === "string") {
    queryVector = await embed(input);
  } else {
    if (input.length === 0) throw new ValidationError("matchAntibody: embedding must be non-empty");
    queryVector = input;
  }

  // Try Atlas $vectorSearch; fall back to cosine if the index doesn't exist.
  try {
    const results = await atlasVectorSearch(queryVector, limit);
    if (results.length > 0) return results;
    // Atlas returned 0 results (no antibodies yet) — fall through to cosine.
  } catch {
    // Atlas vector search unavailable (no index, local MongoDB, etc.)
    // Fall through to cosine fallback.
  }

  return cosineSearch(queryVector, limit);
}

// ── blockRecurrence ───────────────────────────────────────────────────────────

export interface RecurrenceReport {
  total: number;
  passed: number;
  failed: number;
  recurrences: Array<{ antibodyId: string; testFile: string; detail: string }>;
}

/**
 * Runs every minted antibody regression test against the live target app.
 * A test failure signals that the patched vulnerability has recurred.
 * Increments recurrencesBlocked on each affected antibody.
 *
 * Designed for CI gating: the CLI wrapper exits with code 1 if failed > 0.
 */
export async function blockRecurrence(
  opts: { targetUrl?: string } = {},
): Promise<RecurrenceReport> {
  await connectDb();

  const targetUrl = opts.targetUrl ?? process.env["TARGET_URL"] ?? "http://localhost:3001";

  if (!existsSync(ANTIBODY_TEST_DIR)) {
    return { total: 0, passed: 0, failed: 0, recurrences: [] };
  }

  const files = readdirSync(ANTIBODY_TEST_DIR).filter((f) => f.endsWith(".test.ts"));
  if (files.length === 0) {
    return { total: 0, passed: 0, failed: 0, recurrences: [] };
  }

  const recurrences: RecurrenceReport["recurrences"] = [];
  let passed = 0;

  for (const file of files) {
    const testFile = resolve(ANTIBODY_TEST_DIR, file);
    const antibodyId = basename(file, ".test.ts");

    const result = spawnSync(
      VITEST_BIN,
      ["run", testFile, "--reporter=verbose"],
      {
        env: { ...process.env, TARGET_URL: targetUrl },
        encoding: "utf8",
        timeout: 30_000,
      },
    );

    if (result.status === 0) {
      passed++;
    } else {
      const detail = (result.stdout ?? "") + (result.stderr ?? "");
      recurrences.push({ antibodyId, testFile, detail: detail.slice(0, 500) });

      // Increment recurrencesBlocked on the matching antibody.
      const ab = await listAntibodies({ antibodyId } as Partial<Antibody>);
      if (ab[0]) {
        await updateAntibody(ab[0]._id, {
          recurrencesBlocked: (ab[0].recurrencesBlocked ?? 0) + 1,
        });
      }
    }
  }

  return {
    total: files.length,
    passed,
    failed: recurrences.length,
    recurrences,
  };
}
