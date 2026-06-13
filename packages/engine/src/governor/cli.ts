/**
 * CLI — governor:check
 * Usage: pnpm --filter engine governor:check [--window=24h]
 */
/* eslint-disable no-console */
import { resolve } from "path";
import { checkHomeostasis } from "./homeostasis.js";

const REPO_ROOT = resolve(__dirname, "../../../../");

async function main() {
  const windowArg = process.argv.find((a) => a.startsWith("--window="));
  const window = windowArg ? windowArg.split("=")[1]! : "24h";

  console.log(`Governor homeostasis check — window: ${window}`);
  console.log(`Repo: ${REPO_ROOT}\n`);

  const doc = await checkHomeostasis(window);

  const BAR_WIDTH = 20;
  const balanceBar = (n: number) => {
    const clamped = Math.max(-BAR_WIDTH, Math.min(BAR_WIDTH, n));
    if (clamped >= 0) return " ".repeat(BAR_WIDTH) + "│" + "▶".repeat(clamped);
    return " ".repeat(BAR_WIDTH + clamped) + "◀".repeat(-clamped) + "│";
  };

  const ACTION_LABEL: Record<string, string> = {
    ok: "OK",
    reprioritise: "REPRIORITISE",
    gate: "GATE — block deployments",
  };

  console.log("── Homeostasis ──────────────────────────────────────────────");
  console.log(JSON.stringify(doc, null, 2));
  console.log("\n── Summary ───────────────────────────────────────────────────");
  console.log(`  action:           ${ACTION_LABEL[doc.action] ?? doc.action}`);
  console.log(`  balance:          ${doc.balance >= 0 ? "+" : ""}${doc.balance}  ${balanceBar(doc.balance)}`);
  console.log(`  generationRate:   ${doc.generationRate} issues opened in ${window}`);
  console.log(`  repairRate:       ${doc.repairRate} issues resolved in ${window}`);
  if (doc.hottestZones.length) {
    console.log(`  hottestZones:`);
    for (const z of doc.hottestZones) console.log(`    • ${z}`);
  }
}

main().catch((err: unknown) => {
  console.error("governor:check failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
