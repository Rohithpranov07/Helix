#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * CLI: pnpm --filter engine intent:pair
 *
 * Usage:
 *   pnpm --filter engine intent:pair --module=apps/target/src/app/admin/orders/page.tsx
 */
import { pairGenome } from "./pair.js";
import { disconnectDb } from "@helix/db";

function parseArgs(): { modulePath: string | null } {
  const args = process.argv.slice(2);
  const moduleArg = args.find((a) => a.startsWith("--module="));
  return { modulePath: moduleArg ? moduleArg.slice("--module=".length) : null };
}

async function main(): Promise<void> {
  const { modulePath } = parseArgs();

  if (!modulePath) {
    console.error(
      "Usage:\n  pnpm --filter engine intent:pair --module=<repo-relative-path>",
    );
    process.exit(1);
  }

  try {
    console.log(`Base-pairing intent strand for: ${modulePath}\n`);
    const result = await pairGenome(modulePath);

    console.log(`── Pairing Result ────────────────────────────────────────────`);
    console.log(`Score:      ${result.score.toFixed(2)}`);
    console.log(`Mismatches: ${result.mismatches.length}`);
    console.log(`Corrections: ${result.corrections.length}`);
    console.log(``);

    if (result.mismatches.length === 0) {
      console.log("✓ All invariants are satisfied — no drift detected.");
    } else {
      console.log("Unpaired invariants (drift detected):\n");
      for (const m of result.mismatches) {
        console.log(`  [${m.type}] ${m.invariantId}: ${m.description}`);
        console.log(`    evidence: ${m.evidenceRef}`);
      }

      console.log("\nCorrection proposals (gated by Shadow — NOT auto-applied):\n");
      for (const c of result.corrections) {
        console.log(`  ${c.invariantId}:`);
        console.log(`    explanation: ${c.explanation}`);
        console.log(`    requiresShadowVerification: ${c.requiresShadowVerification}`);
        console.log(`    suggestedPatch:\n${c.suggestedPatch.split("\n").map((l) => "      " + l).join("\n")}`);
      }
    }

    console.log("\n── Updated Strand Pairing ──────────────────────────────────");
    console.log(JSON.stringify(result.strand.pairing, null, 2));
  } finally {
    await disconnectDb();
  }
}

main().catch((err: unknown) => {
  console.error("intent:pair failed:", err);
  process.exit(1);
});
