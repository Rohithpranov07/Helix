#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * CLI: pnpm --filter engine entropy:measure
 *
 * Usage:
 *   pnpm --filter engine entropy:measure
 *   pnpm --filter engine entropy:measure --path=apps/target/src
 */
import { measureEntropy } from "./temperature.js";
import { disconnectDb } from "@helix/db";
import { resolve } from "path";

// packages/engine/src/metabolism/ → 4 levels up = repo root
const REPO_ROOT = resolve(__dirname, "../../../../");

function parseArgs(): { repoPath: string } {
  const args = process.argv.slice(2);
  const pathArg = args.find((a) => a.startsWith("--path="));
  const rel = pathArg ? pathArg.slice("--path=".length) : ".";
  return { repoPath: resolve(REPO_ROOT, rel) };
}

async function main(): Promise<void> {
  const { repoPath } = parseArgs();
  console.log(`Measuring entropy for: ${repoPath}\n`);

  try {
    const point = await measureEntropy(repoPath);

    console.log("── EntropyPoint ──────────────────────────────────────────────");
    console.log(JSON.stringify(point, null, 2));

    console.log("\n── Summary ───────────────────────────────────────────────────");
    console.log(`  temperature:          ${point.temperature.toFixed(3)}`);
    console.log(`  projectedRewriteWeeks: ${point.projectedRewriteWeeks}`);
    console.log("");
    console.log("  Dimensions:");
    for (const [k, v] of Object.entries(point.dims)) {
      const bar = "█".repeat(Math.round((v as number) * 20));
      console.log(`    ${k.padEnd(20)} ${(v as number).toFixed(2)}  ${bar}`);
    }
  } finally {
    await disconnectDb();
  }
}

main().catch((err: unknown) => {
  console.error("entropy:measure failed:", err);
  process.exit(1);
});
