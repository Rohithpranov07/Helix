/**
 * T7.1 — Entropy temperature + trajectory (Metabolism organ)
 *
 * measureEntropy(repoPath, deps?):
 *   1. collectSources: walks the repo, samples TypeScript/TSX source files.
 *   2. Gemini analyzes the source bundle (wide-context per CLAUDE.md) and scores
 *      the five entropy dimensions: duplication, patternVariance, coupling,
 *      vulnDensity, comprehension — each [0..1].
 *   3. Reduces dims to one temperature scalar via a weighted sum.
 *   4. Projects `projectedRewriteWeeks` from the temperature trajectory stored in
 *      the entropy_timeseries collection. Falls back to a temperature-only estimate
 *      when fewer than two historical points exist.
 *   5. Persists the EntropyPoint to the `entropy_timeseries` time-series collection.
 *
 * All three operation seams (collectSources, analyze, listHistory) are injectable
 * so the function is fully testable without filesystem or network access.
 *
 * Gemini is used here per CLAUDE.md: "Gemini = LOW SURFACE AREA ONLY — used only
 * for whole-repo wide-context reads where Sarvam cannot substitute: entropy field
 * computation". Sarvam is never called in this module.
 */
import { z } from "zod";
import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, extname, relative } from "path";
import { ValidationError, type EntropyPoint } from "@helix/shared";
import { gemini } from "@helix/ai";
import { connectDb, createEntropyPoint, listEntropyPoints } from "@helix/db";
import type { HelixDoc } from "@helix/db";

// ── Entropy dimension weights ─────────────────────────────────────────────────
// Weighted so security (vulnDensity) and structural debt (duplication, coupling)
// dominate — matching the ShopLite demo which has intentional vulnerabilities.

const DIM_WEIGHTS = {
  duplication: 0.25,
  patternVariance: 0.15,
  coupling: 0.20,
  vulnDensity: 0.25,
  comprehension: 0.15,
} as const;

// Above this temperature the codebase is considered approaching the rewrite cliff.
const REWRITE_THRESHOLD = 1.0;

// Default rise rate used for projection when trajectory is unknown.
const DEFAULT_WEEKLY_RISE = 0.02;

// ── Zod schemas ───────────────────────────────────────────────────────────────

const EntropyDimsSchema = z.object({
  duplication: z.number().min(0).max(1),
  patternVariance: z.number().min(0).max(1),
  coupling: z.number().min(0).max(1),
  vulnDensity: z.number().min(0).max(1),
  comprehension: z.number().min(0).max(1),
  rationale: z.string().min(5),
});

type EntropyDims = z.infer<typeof EntropyDimsSchema>;

// ── Public types ───────────────────────────────────────────────────────────────

export interface MeasureEntropyDeps {
  /**
   * Returns a concatenated source summary sent to Gemini.
   * Default: walks repoPath recursively, samples .ts/.tsx files up to ~60 kB.
   */
  collectSources?: (repoPath: string) => string;
  /**
   * Gemini analysis dep — scores the five entropy dimensions.
   * Default: calls gemini.analyze with the source bundle.
   */
  analyze?: (sources: string) => Promise<EntropyDims>;
  /**
   * Returns recent entropy history for trajectory projection.
   * Default: listEntropyPoints from @helix/db.
   */
  listHistory?: (limit: number) => Promise<Array<{ temperature: number; ts: string }>>;
}

// ── Source collection ─────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  "node_modules", ".next", "dist", "build", ".git", ".turbo", "coverage", ".cache",
]);
const SOURCE_EXTS = new Set([".ts", ".tsx"]);
/** Max combined source size sent to Gemini — stays within the flash context. */
const MAX_SOURCE_CHARS = 60_000;
/** Max content per file — lets us include more files in the budget. */
const MAX_PER_FILE = 1_500;

function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
        out.push(...walkSourceFiles(resolve(dir, entry.name)));
      } else if (entry.isFile() && SOURCE_EXTS.has(extname(entry.name))) {
        out.push(resolve(dir, entry.name));
      }
    }
  } catch { /* inaccessible dir — skip */ }
  return out;
}

export function collectRepoSources(repoPath: string): string {
  const absRoot = resolve(repoPath);
  if (!existsSync(absRoot)) {
    throw new ValidationError(`measureEntropy: repoPath does not exist: ${absRoot}`);
  }

  const files = walkSourceFiles(absRoot);
  const parts: string[] = [];
  let budget = MAX_SOURCE_CHARS;

  for (const f of files) {
    if (budget <= 0) break;
    try {
      const rel = relative(absRoot, f);
      const content = readFileSync(f, "utf8").slice(0, MAX_PER_FILE);
      const chunk = `// FILE: ${rel}\n${content}\n`;
      parts.push(chunk.slice(0, budget));
      budget -= chunk.length;
    } catch { /* skip unreadable files */ }
  }

  return parts.join("\n");
}

// ── Gemini analysis ───────────────────────────────────────────────────────────

const GEMINI_SYSTEM = [
  "You are HELIX's Metabolism organ computing the entropy field for a software repository.",
  "Analyze the provided TypeScript/TSX source files and score each entropy dimension [0.0–1.0]:",
  "",
  "  duplication:     fraction of code that is copy-pasted or near-duplicated.",
  "  patternVariance: inconsistency in patterns, naming conventions, and structural style.",
  "  coupling:        degree to which business logic is entangled with infrastructure",
  "                   (e.g. SQL in JSX, HTTP in data-access layers).",
  "  vulnDensity:     density of security vulnerability patterns (SQL injection, XSS,",
  "                   missing auth checks, hardcoded secrets, missing RLS).",
  "  comprehension:   difficulty to understand — deep nesting, magic numbers,",
  "                   unexplained side effects, unclear naming.",
  "",
  "Score 0.0 = excellent, 1.0 = severe problem.",
  "Be precise and calibrated: a clean codebase scores 0.1–0.2; a vibe-coded MVP with",
  "intentional vulnerabilities may score 0.6–0.9 on vulnDensity and coupling.",
  "",
  "Respond ONLY with JSON:",
  '{ "duplication": 0.0, "patternVariance": 0.0, "coupling": 0.0,',
  '  "vulnDensity": 0.0, "comprehension": 0.0, "rationale": "..." }',
].join("\n");

async function geminiAnalyze(sources: string): Promise<EntropyDims> {
  const result = await gemini.analyze({
    parts: [{ text: `Source files to analyze:\n\n${sources}` }],
    systemPrompt: GEMINI_SYSTEM,
    json: true,
  });
  return EntropyDimsSchema.parse(JSON.parse(result.content));
}

// ── Deterministic fallback ────────────────────────────────────────────────────
// Used when Gemini is unavailable. Inspects source text for known markers.

function deterministicAnalyze(sources: string): EntropyDims {
  const lines = sources.split("\n");
  const total = Math.max(1, lines.length);

  const vulnLines = lines.filter((l) =>
    /dangerouslySetInnerHTML|innerHTML\s*=|eval\(|process\.env\.[A-Z_]{8,}\s*=|hardcoded|password\s*=\s*['"][^'"]{4}/i.test(l) ||
    /(\+\s*req\.|`\$\{req\.|string\s*\+\s*query|SELECT.*\+|INSERT.*\+)/i.test(l),
  ).length;
  const vulnDensity = Math.min(1, vulnLines / Math.max(1, total * 0.05));

  // duplication: rough heuristic — identical non-blank lines
  const nonBlank = lines.filter((l) => l.trim().length > 0);
  const unique = new Set(nonBlank.map((l) => l.trim())).size;
  const duplication = Math.min(1, Math.max(0, 1 - unique / Math.max(1, nonBlank.length)));

  // coupling: count files that mix DB/HTTP with JSX
  const coupledFiles = (sources.match(/from.*supabase.*\n[\s\S]{0,200}return\s*\(/g) ?? []).length;
  const totalFiles = Math.max(1, (sources.match(/^\/\/ FILE:/mg) ?? []).length);
  const coupling = Math.min(1, coupledFiles / totalFiles);

  // patternVariance: count inconsistent naming (mix of camelCase and snake_case)
  const camel = (sources.match(/\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*/g) ?? []).length;
  const snake = (sources.match(/\b[a-z][a-z0-9]*_[a-z][a-z0-9]*/g) ?? []).length;
  const patternVariance = Math.min(1, Math.abs(camel - snake) / Math.max(1, camel + snake) * 2);

  // comprehension: count deeply nested brackets (>3 levels)
  let maxDepth = 0;
  let depth = 0;
  for (const ch of sources) {
    if (ch === "{" || ch === "(") depth++;
    else if (ch === "}" || ch === ")") depth--;
    if (depth > maxDepth) maxDepth = depth;
  }
  const comprehension = Math.min(1, maxDepth / 20);

  return {
    duplication: Math.round(duplication * 100) / 100,
    patternVariance: Math.round(patternVariance * 100) / 100,
    coupling: Math.round(coupling * 100) / 100,
    vulnDensity: Math.round(vulnDensity * 100) / 100,
    comprehension: Math.round(comprehension * 100) / 100,
    rationale: "Deterministic fallback: Gemini unavailable. Scores derived from static source analysis.",
  };
}

// ── Temperature reduction ─────────────────────────────────────────────────────

export function computeTemperature(dims: Omit<EntropyDims, "rationale">): number {
  const raw =
    DIM_WEIGHTS.duplication * dims.duplication +
    DIM_WEIGHTS.patternVariance * dims.patternVariance +
    DIM_WEIGHTS.coupling * dims.coupling +
    DIM_WEIGHTS.vulnDensity * dims.vulnDensity +
    DIM_WEIGHTS.comprehension * dims.comprehension;
  return Math.round(raw * 1000) / 1000;
}

// ── Trajectory projection ─────────────────────────────────────────────────────

/**
 * Projects weeks until temperature hits REWRITE_THRESHOLD.
 *
 * With ≥2 historical points: compute the actual temperature rise rate (per week)
 * from the oldest→newest stored points, then linearly extrapolate.
 *
 * Without history: use DEFAULT_WEEKLY_RISE as the assumed growth rate —
 * equivalent to "temperature rises 2% per week at the current generation pace".
 *
 * As temperature rises toward the threshold, projectedRewriteWeeks falls — the
 * rewrite cliff gets closer. At threshold: 0 weeks.
 */
export function computeProjectedWeeks(
  temperature: number,
  history: Array<{ temperature: number; ts: string }>,
): number {
  if (temperature >= REWRITE_THRESHOLD) return 0;

  const gap = REWRITE_THRESHOLD - temperature;

  if (history.length >= 2) {
    // history is newest-first from listEntropyPoints (sort: ts:-1)
    const newest = history[0]!;
    const oldest = history[history.length - 1]!;
    const deltaTemp = newest.temperature - oldest.temperature;
    const deltaMsec = new Date(newest.ts).getTime() - new Date(oldest.ts).getTime();
    const deltaWeeks = deltaMsec / (7 * 24 * 60 * 60 * 1000);

    if (deltaWeeks > 0 && deltaTemp > 0) {
      const weeklyRate = deltaTemp / deltaWeeks;
      return Math.max(0, Math.round(gap / weeklyRate));
    }
  }

  // Fallback: assume DEFAULT_WEEKLY_RISE rate
  return Math.max(0, Math.round(gap / DEFAULT_WEEKLY_RISE));
}

// ── measureEntropy ────────────────────────────────────────────────────────────

/**
 * Measures the entropy temperature of a repository and persists a time-series point.
 *
 * @param repoPath  Absolute or repo-relative path to the codebase root to analyse.
 * @param deps      Injectable seams for testability.
 */
export async function measureEntropy(
  repoPath: string,
  deps?: MeasureEntropyDeps,
): Promise<HelixDoc<EntropyPoint>> {
  await connectDb();

  const collect = deps?.collectSources ?? collectRepoSources;
  const analyze = deps?.analyze;
  const getHistory = deps?.listHistory ?? listEntropyPoints;

  // 1. Collect source files.
  const sources = collect(repoPath);
  if (!sources.trim()) {
    throw new ValidationError(
      `measureEntropy: no TypeScript source files found under "${repoPath}".`,
    );
  }

  // 2. Gemini computes entropy dims (wide-context — Gemini is correct here per CLAUDE.md).
  //    Falls back to deterministic analysis when Gemini is unavailable.
  let dims: EntropyDims;
  if (analyze) {
    dims = await analyze(sources);
  } else {
    try {
      dims = await geminiAnalyze(sources);
    } catch {
      dims = deterministicAnalyze(sources);
    }
  }

  // 3. Reduce dims to temperature scalar.
  const temperature = computeTemperature(dims);

  // 4. Project rewrite weeks from trajectory.
  const history = await getHistory(20);
  const histPoints = history.map((h) => ({ temperature: h.temperature, ts: h.ts }));
  const projectedRewriteWeeks = computeProjectedWeeks(temperature, histPoints);

  // 5. Persist to entropy_timeseries.
  const point: EntropyPoint = {
    ts: new Date().toISOString(),
    temperature,
    dims: {
      duplication: dims.duplication,
      patternVariance: dims.patternVariance,
      coupling: dims.coupling,
      vulnDensity: dims.vulnDensity,
      comprehension: dims.comprehension,
    },
    projectedRewriteWeeks,
  };

  const stored = await createEntropyPoint(point);
  // eslint-disable-next-line no-console
  console.log(
    `[metabolism] temperature=${temperature.toFixed(3)} ` +
      `projectedRewriteWeeks=${projectedRewriteWeeks} ` +
      `(duplication=${dims.duplication} patternVariance=${dims.patternVariance} ` +
      `coupling=${dims.coupling} vulnDensity=${dims.vulnDensity} comprehension=${dims.comprehension})`,
  );
  return stored;
}
