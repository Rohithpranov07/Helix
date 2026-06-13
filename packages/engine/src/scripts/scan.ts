#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * CLI: pnpm --filter engine scan --url=http://localhost:3001
 *
 * When the target is ShopLite (:3001) prints precision/recall vs vulns.manifest.json
 */
import { scanTarget } from "../immune/scanner.js";
import { AuthorizationError, type VulnClass } from "@helix/shared";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

interface ManifestEntry { class: string; endpoint: string; expectedDetection: string; }

function parseArgs(): { url: string } {
  const urlArg = process.argv.find((a) => a.startsWith("--url="));
  if (!urlArg) {
    console.error("Usage: pnpm --filter engine scan --url=<targetUrl>");
    process.exit(1);
  }
  return { url: urlArg.slice(6) };
}

function loadManifest(targetUrl: string): ManifestEntry[] | null {
  if (!targetUrl.includes("localhost:3001") && !targetUrl.includes("3001")) return null;
  // Look for manifest relative to repo root
  const paths = [
    resolve(process.cwd(), "apps/target/vulns.manifest.json"),
    resolve(process.cwd(), "../../apps/target/vulns.manifest.json"),
    resolve(__dirname, "../../../../apps/target/vulns.manifest.json"),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, "utf8")) as ManifestEntry[];
    }
  }
  return null;
}

async function main() {
  const { url } = parseArgs();

  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  HELIX Immune Scanner — T2.1             ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`Target : ${url}`);
  console.log(`Allowlist: ${process.env["TARGET_ALLOWLIST"] ?? "(not set)"}\n`);

  let findings;
  try {
    findings = await scanTarget(url);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      console.error(`\n✗ BLOCKED — ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  if (findings.length === 0) {
    console.log("✓ No vulnerabilities detected.");
  } else {
    console.log(`Found ${findings.length} vulnerability/ies:\n`);
    for (const f of findings) {
      console.log(`  [${f.class.padEnd(12)}] ${f.endpoint}`);
      console.log(`    evidence: ${f.evidence.slice(0, 180)}`);
      console.log();
    }
  }

  // Precision / recall vs ShopLite manifest
  const manifest = loadManifest(url);
  if (manifest) {
    console.log("─── Precision / Recall vs vulns.manifest.json ───");
    const detectedClasses = new Set(findings.map((f) => f.class));
    const manifestClasses = manifest.map((m) => m.class);

    const truePositives = manifestClasses.filter((c) => detectedClasses.has(c as VulnClass));
    const falseNegatives = manifestClasses.filter((c) => !detectedClasses.has(c as VulnClass));
    const falsePositives = findings.filter((f) => !(manifestClasses as string[]).includes(f.class));

    const precision = findings.length > 0 ? truePositives.length / findings.length : 0;
    const recall = manifestClasses.length > 0 ? truePositives.length / manifestClasses.length : 0;

    console.log(`  True positives  : ${truePositives.join(", ") || "none"}`);
    console.log(`  False negatives : ${falseNegatives.join(", ") || "none"}`);
    console.log(`  False positives : ${falsePositives.map((f) => f.class).join(", ") || "none"}`);
    console.log(`  Precision : ${(precision * 100).toFixed(0)}%`);
    console.log(`  Recall    : ${(recall * 100).toFixed(0)}%`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Scanner error:", err);
  process.exit(1);
});
