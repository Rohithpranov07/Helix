#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * CLI: pnpm --filter engine intent:capture
 *
 * Usage:
 *   pnpm --filter engine intent:capture --module=apps/target/src/app/api/products/search/route.ts
 *   pnpm --filter engine intent:capture --module=<path> --context="PR: ..."
 *   pnpm --filter engine intent:capture --seed          (seeds all ShopLite modules)
 */
import { captureIntent, seedShopLite } from "./capture.js";
import { disconnectDb } from "@helix/db";

function parseArgs(): { seed: boolean; modulePath: string | null; context: string } {
  const args = process.argv.slice(2);
  const seed = args.includes("--seed");
  const moduleArg = args.find((a) => a.startsWith("--module="));
  const contextArg = args.find((a) => a.startsWith("--context="));
  return {
    seed,
    modulePath: moduleArg ? moduleArg.slice("--module=".length) : null,
    context: contextArg ? contextArg.slice("--context=".length) : "",
  };
}

async function main(): Promise<void> {
  const { seed, modulePath, context } = parseArgs();

  if (!seed && !modulePath) {
    console.error(
      "Usage:\n" +
        "  pnpm --filter engine intent:capture --module=<repo-relative-path>\n" +
        "  pnpm --filter engine intent:capture --module=<path> --context=\"PR description\"\n" +
        "  pnpm --filter engine intent:capture --seed",
    );
    process.exit(1);
  }

  try {
    if (seed) {
      console.log("Seeding ShopLite intent strands…\n");
      const strands = await seedShopLite();
      console.log(`\n✓ Seeded ${strands.length} intent strands.\n`);
      for (const s of strands) {
        const complianceCount = s.invariants.filter((i) => i.compliance === true).length;
        console.log(`  ${s.moduleId}`);
        console.log(`    purpose: ${s.purpose.slice(0, 80)}…`);
        console.log(`    invariants: ${s.invariants.length} (${complianceCount} compliance)`);
        console.log(`    _id: ${s._id}\n`);
      }
    } else if (modulePath) {
      console.log(`Capturing intent for: ${modulePath}\n`);
      const strand = await captureIntent(modulePath, context);
      console.log("\n── Intent Strand ────────────────────────────────────────────");
      console.log(JSON.stringify(strand, null, 2));
    }
  } finally {
    await disconnectDb();
  }
}

main().catch((err: unknown) => {
  console.error("intent:capture failed:", err);
  process.exit(1);
});
