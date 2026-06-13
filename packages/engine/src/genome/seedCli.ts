/**
 * CLI — seed:shoplite
 * Seeds intent strands for all five ShopLite modules. Idempotent (upserts).
 * Usage: pnpm --filter engine seed:shoplite
 */
/* eslint-disable no-console */
import { connectDb } from "@helix/db";
import { seedShopLite } from "./capture.js";

async function main() {
  console.log("Seeding ShopLite intent genome (5 modules)...\n");
  await connectDb();
  const strands = await seedShopLite();
  for (const s of strands) {
    const score = s.pairing?.score ?? "n/a";
    console.log(`  ✓  ${s.moduleId}  (pairing score: ${score})`);
  }
  console.log(`\nDone — ${strands.length} strand(s) seeded.\n`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("seed:shoplite failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
