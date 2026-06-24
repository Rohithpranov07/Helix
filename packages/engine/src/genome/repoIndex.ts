/**
 * GitHub repository indexer — Genome organ.
 *
 * Flow:
 *   1. Fetch the full file tree from GitHub.
 *   2. Filter to source files; group into logical modules by top-level directory.
 *   3. Identify intent documents (README, PRD, SPEC, ARCHITECTURE, *.md in root).
 *   4. For each module: Gemini reads code + intent docs together (wide-context).
 *      Groq extracts a structured IntentStrand (strict-JSON).
 *   5. Persist / upsert each strand in the intent_strand collection.
 *
 * Per §3 stack mapping: Gemini = whole-codebase base-pairing; Groq = extraction.
 */
import type { IntentStrand } from "@helix/shared";
import { connectDb, createIntentStrand, updateIntentStrand, listIntentStrands } from "@helix/db";
import { gemini, groq } from "@helix/ai";
import { z } from "zod";
import { getRepoTree, readFile } from "./github.js";

// ── Constants ─────────────────────────────────────────────────────────────────

// Source extensions we index
const SOURCE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".rb",
  ".php", ".cs", ".swift", ".kt", ".scala", ".sql", ".sh", ".yaml", ".yml",
]);

// Paths to always skip
const SKIP_PATTERNS = [
  "node_modules", ".next", "dist", "build", "coverage", ".git",
  "pnpm-lock", "package-lock", "yarn.lock", "__pycache__", ".venv",
  "vendor", ".turbo", "out",
];

const INTENT_DOC_NAMES = [
  "readme", "prd", "spec", "architecture", "design", "requirements",
  "overview", "intent", "contract", "api", "docs",
];

const MAX_FILE_SIZE = 80_000;  // bytes — skip very large files
const MAX_FILES_PER_MODULE = 30;
const MAX_CONTENT_PER_MODULE = 60_000; // chars fed to Gemini

// ── Schema for Groq JSON output ─────────────────────────────────────────────
//
// Qwen3.6-27B often emits a looser shape than asked — e.g. invariants as a bare
// array of strings, or objects keyed `name`/`description` instead of
// `rule`/`rationale`. Rather than reject (which forces slow repair round-trips
// or drops the module), accept these forms and normalise them below. This is the
// core "flakiness" fix on the engine side.

const LooseInvariantSchema = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    rule: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    rationale: z.string().optional(),
    reason: z.string().optional(),
    compliance: z.boolean().optional(),
  }),
]);

const IntentStrandOutputSchema = z.object({
  purpose: z.string(),
  invariants: z.array(LooseInvariantSchema).default([]),
  edgeDecisions: z.array(z.union([z.string(), z.object({}).passthrough()])).default([]),
});

type NormalizedInvariant = { id: string; rule: string; rationale: string; compliance?: boolean };

function normalizeInvariants(raw: z.infer<typeof IntentStrandOutputSchema>["invariants"]): NormalizedInvariant[] {
  const out: NormalizedInvariant[] = [];
  raw.forEach((item, i) => {
    const id = `inv-${i + 1}`;
    if (typeof item === "string") {
      if (item.trim()) out.push({ id, rule: item.trim(), rationale: "" });
      return;
    }
    const rule = item.rule ?? item.name ?? item.title ?? item.description ?? "";
    const rationale = item.rationale ?? item.reason ?? (item.rule ? (item.description ?? "") : "");
    if (!rule.trim()) return;
    out.push({
      id: item.id ?? id,
      rule: rule.trim(),
      rationale: rationale.trim(),
      ...(item.compliance !== undefined ? { compliance: item.compliance } : {}),
    });
  });
  return out;
}

function normalizeEdgeDecisions(raw: z.infer<typeof IntentStrandOutputSchema>["edgeDecisions"]): string[] {
  return raw
    .map((d) => (typeof d === "string" ? d : JSON.stringify(d)))
    .filter((d) => d.trim().length > 0);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shouldSkip(path: string): boolean {
  // Match whole path SEGMENTS, never arbitrary substrings. A substring match
  // treated "out" (a build-dir pattern) as present in every Next.js "route.ts"
  // ("r-out-e") and in "checkout", silently skipping every API route handler —
  // exactly where SQLi/authBypass vulns live. Lockfiles are matched by prefix.
  return path.split("/").some(
    (seg) =>
      SKIP_PATTERNS.includes(seg) ||
      seg.startsWith("pnpm-lock") ||
      seg.startsWith("package-lock"),
  );
}

function isSourceFile(path: string): boolean {
  const ext = path.slice(path.lastIndexOf("."));
  return SOURCE_EXTS.has(ext);
}

function isIntentDoc(path: string): boolean {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  return name.endsWith(".md") || INTENT_DOC_NAMES.some((n) => name.includes(n));
}

function moduleOf(path: string): string {
  const parts = path.split("/");
  // Module = the file's PARENT DIRECTORY, so distinct routes/pages/libs become
  // distinct strands. Using only the top-level directory collapses repos that
  // nest everything under one folder (e.g. "ShopLite/...") into a single module,
  // which hides every per-file invariant behind one coarse strand.
  if (parts.length <= 1) return "root";
  return parts.slice(0, -1).join("/");
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface IndexRepoOptions {
  token: string;
  owner: string;
  repo: string;
  intentDocPaths?: string[]; // caller-specified PRD / spec files
  intentDocsContent?: string[] | undefined; // caller-provided content
}

export async function indexGitHubRepo(
  opts: IndexRepoOptions,
): Promise<IntentStrand[]> {
  const { token, owner, repo, intentDocPaths = [], intentDocsContent = [] } = opts;

  // 1. Fetch full tree
  const tree = await getRepoTree(token, owner, repo);

  // 2. Collect intent documents first (shared context for all modules)
  const intentDocFiles = tree.filter(
    (f) =>
      !shouldSkip(f.path) &&
      (intentDocPaths.includes(f.path) || (isIntentDoc(f.path) && !f.path.includes("/"))),
  );

  let sharedIntentContext = "";
  for (const f of intentDocFiles.slice(0, 5)) {
    const file = await readFile(token, owner, repo, f.path);
    if (file) {
      sharedIntentContext += `\n\n=== INTENT DOCUMENT: ${f.path} ===\n${file.content.slice(0, 10_000)}`;
    }
  }

  // 2b. Add directly uploaded intent docs
  for (let i = 0; i < intentDocsContent.length; i++) {
    sharedIntentContext += `\n\n=== UPLOADED INTENT DOCUMENT ${i + 1} ===\n${intentDocsContent[i]!.slice(0, 10_000)}`;
  }

  // 3. Group source files by module
  const moduleMap = new Map<string, string[]>();
  for (const f of tree) {
    if (shouldSkip(f.path) || !isSourceFile(f.path)) continue;
    if ((f.size ?? 0) > MAX_FILE_SIZE) continue;
    const mod = moduleOf(f.path);
    if (!moduleMap.has(mod)) moduleMap.set(mod, []);
    moduleMap.get(mod)!.push(f.path);
  }

  // 4. Process each module
  await connectDb();
  const strands: IntentStrand[] = [];

  for (const [modName, filePaths] of moduleMap) {
    try {
    // Skip modules with no meaningful files
    const selected = filePaths.slice(0, MAX_FILES_PER_MODULE);

    // Read source files
    let sourceContent = "";
    for (const path of selected) {
      const file = await readFile(token, owner, repo, path);
      if (!file) continue;
      const chunk = file.content.slice(0, 3_000);
      sourceContent += `\n\n=== FILE: ${path} ===\n${chunk}`;
      if (sourceContent.length > MAX_CONTENT_PER_MODULE) break;
    }
    if (!sourceContent.trim()) continue;

    // 4a. Gemini wide-context: understand code + intent together
    let geminiSummary = "";
    try {
      const geminiResult = await gemini.analyze({
        parts: [
          {
            text:
              `You are analyzing the "${modName}" module of the "${owner}/${repo}" repository.\n` +
              `Summarize in 3-5 sentences: what this module does, its key responsibilities, ` +
              `and any critical invariants or constraints evident from the code or documents.\n` +
              `${sharedIntentContext ? `\n${sharedIntentContext}` : ""}` +
              `\n\n${sourceContent.slice(0, MAX_CONTENT_PER_MODULE)}`,
          },
        ],
        systemPrompt: "You are a code architecture analyst. Be concise and precise.",
      });
      geminiSummary = geminiResult.content;
    } catch {
      geminiSummary = `Module: ${modName} in ${owner}/${repo}. Files: ${selected.join(", ")}`;
    }

    // 4b. Groq strict-JSON: extract structured intent strand
    const strandResult = await groq.chat({
      messages: [
        {
          role: "system",
          content:
            "You are HELIX Genome. Extract a structured intent strand from the provided code module.\n" +
            "Output ONLY valid JSON with EXACTLY these fields, no others:\n" +
            '{"purpose":"string","invariants":[{"id":"string","rule":"string","rationale":"string"}],"edgeDecisions":["string"]}\n' +
            "invariants must capture every critical business rule AND security constraint the module SHOULD uphold.\n" +
            "Always state the security invariant as what MUST be true (the correct behaviour), even if the current code violates it. " +
            "In particular, for modules that touch these areas, emit the matching invariant:\n" +
            "  - SQL/DB queries with user input → 'all queries must be parameterized (no string interpolation of user input)'.\n" +
            "  - rendering user-controlled data → 'user content must be escaped, never rendered as raw HTML'.\n" +
            "  - protected routes/handlers → 'requests must be authenticated and authorized before any action'.\n" +
            "  - clients/config holding keys → 'service-role keys/secrets must never be exposed to client-side or bundled code'.\n" +
            "  - DB tables/migrations with per-user rows → 'sensitive tables must have Row-Level Security (RLS) enabled with a policy'.\n" +
            "If no invariants are found, output an empty array. Do NOT add any extra fields.",
        },
        {
          role: "user",
          content:
            `Module: ${modName}\nRepo: ${owner}/${repo}\n\n` +
            `Gemini architectural summary:\n${geminiSummary}\n\n` +
            `Source files sampled:\n${sourceContent.slice(0, 20_000)}\n\n` +
            `${sharedIntentContext ? `Intent documents:\n${sharedIntentContext}` : ""}`,
        },
      ],
      schema: IntentStrandOutputSchema,
      temperature: 0.1,
    });
    const strand = JSON.parse(strandResult.content) as z.infer<typeof IntentStrandOutputSchema>;

    const moduleId = `${owner}/${repo}/${modName}`;
    const strandDoc: IntentStrand = {
      moduleId,
      purpose: strand.purpose,
      invariants: normalizeInvariants(strand.invariants),
      edgeDecisions: normalizeEdgeDecisions(strand.edgeDecisions),
      sourcePrompt: `Indexed from GitHub ${owner}/${repo} module ${modName}`,
      generatedBy: { model: "qwen3.6-27b", version: "1.0" },
      pairing: {
        score: 1.0, // initial — will be updated by drift detection
        lastChecked: new Date().toISOString(),
        unpairedInvariants: [],
      },
    };

    // Upsert: update if exists, create if new
    const existing = (await listIntentStrands({ moduleId }))[0];
    if (existing) {
      await updateIntentStrand(existing._id, strandDoc);
    } else {
      await createIntentStrand(strandDoc);
    }
    strands.push(strandDoc);
    } catch (modErr) {
      // Log but don't abort — one bad module shouldn't kill the full index run
      // eslint-disable-next-line no-console
      console.warn(`[genome/index] skipping module ${modName}:`, modErr instanceof Error ? modErr.message : modErr);
    }
  }

  return strands;
}
