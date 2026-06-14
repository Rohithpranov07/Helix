/**
 * GitHub repository indexer — Genome organ.
 *
 * Flow:
 *   1. Fetch the full file tree from GitHub.
 *   2. Filter to source files; group into logical modules by top-level directory.
 *   3. Identify intent documents (README, PRD, SPEC, ARCHITECTURE, *.md in root).
 *   4. For each module: Gemini reads code + intent docs together (wide-context).
 *      Sarvam extracts a structured IntentStrand (strict-JSON).
 *   5. Persist / upsert each strand in the intent_strand collection.
 *
 * Per §3 stack mapping: Gemini = whole-codebase base-pairing; Sarvam = extraction.
 */
import type { IntentStrand } from "@helix/shared";
import { connectDb, createIntentStrand, updateIntentStrand, listIntentStrands } from "@helix/db";
import { gemini, sarvam } from "@helix/ai";
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

// ── Schema for Sarvam JSON output ─────────────────────────────────────────────

const InvariantOutputSchema = z.object({
  id: z.string(),
  rule: z.string(),
  rationale: z.string(),
  compliance: z.boolean().optional(),
});

const IntentStrandOutputSchema = z.object({
  purpose: z.string(),
  invariants: z.array(InvariantOutputSchema).default([]),
  edgeDecisions: z.array(z.string()).default([]),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function shouldSkip(path: string): boolean {
  return SKIP_PATTERNS.some((p) => path.includes(p));
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
  // Use top-level directory as module boundary; root files → "root"
  return parts.length > 1 ? (parts[0] ?? "root") : "root";
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface IndexRepoOptions {
  token: string;
  owner: string;
  repo: string;
  intentDocPaths?: string[]; // caller-specified PRD / spec files
  intentDocsContent?: string[]; // caller-provided content
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

    // 4b. Sarvam strict-JSON: extract structured intent strand
    const strandResult = await sarvam.chat({
      messages: [
        {
          role: "system",
          content:
            "You are HELIX Genome. Extract a structured intent strand from the provided code module.\n" +
            "Output ONLY valid JSON with EXACTLY these fields, no others:\n" +
            '{"purpose":"string","invariants":[{"id":"string","rule":"string","rationale":"string"}],"edgeDecisions":["string"]}\n' +
            "invariants must capture every critical business rule and security constraint visible in the code.\n" +
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
      invariants: strand.invariants.map((inv) => ({
        id: inv.id,
        rule: inv.rule,
        rationale: inv.rationale,
        ...(inv.compliance !== undefined ? { compliance: inv.compliance } : {}),
      })),
      edgeDecisions: strand.edgeDecisions,
      sourcePrompt: `Indexed from GitHub ${owner}/${repo} module ${modName}`,
      generatedBy: { model: "sarvam-m1", version: "1.0" },
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
