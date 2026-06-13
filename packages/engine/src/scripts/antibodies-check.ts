/**
 * CLI: pnpm --filter engine antibodies:check
 *
 * Runs all minted antibody regression tests against the live target app.
 * Exits with code 1 if any vulnerability has recurred (CI gate).
 *
 * Usage:
 *   pnpm --filter engine antibodies:check
 *   TARGET_URL=http://localhost:3001 pnpm --filter engine antibodies:check
 */
import { blockRecurrence } from "../memory/recall.js";

async function main(): Promise<void> {
  const targetUrl = process.env["TARGET_URL"] ?? "http://localhost:3001";

  // eslint-disable-next-line no-console
  console.log(`\n[HELIX Immune Memory] Running antibody regression tests…`);
  // eslint-disable-next-line no-console
  console.log(`  target: ${targetUrl}\n`);

  const report = await blockRecurrence({ targetUrl });

  // eslint-disable-next-line no-console
  console.log(
    `  total: ${report.total}  passed: ${report.passed}  failed: ${report.failed}\n`,
  );

  if (report.recurrences.length > 0) {
    // eslint-disable-next-line no-console
    console.error("[HELIX] RECURRENCE DETECTED — vulnerabilities have re-appeared:\n");
    for (const r of report.recurrences) {
      // eslint-disable-next-line no-console
      console.error(`  antibody: ${r.antibodyId}`);
      // eslint-disable-next-line no-console
      console.error(`  test:     ${r.testFile}`);
      // eslint-disable-next-line no-console
      console.error(`  detail:   ${r.detail.slice(0, 300)}\n`);
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log("[HELIX] All antibody regression tests passed. No recurrences detected.");
  process.exit(0);
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("[HELIX] antibodies:check fatal error:", err);
  process.exit(1);
});
