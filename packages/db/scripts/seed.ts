import "dotenv/config";
import { connectDb, disconnectDb } from "../src/connect.js";
import { ensureTimeSeriesCollection } from "../src/ensureCollections.js";
import { createIntentStrand } from "../src/repos/intentStrand.js";
import { createVulnerability } from "../src/repos/vulnerability.js";
import { createAntibody } from "../src/repos/antibody.js";
import { createEntropyPoint } from "../src/repos/entropyTimeseries.js";
import { createIncident } from "../src/repos/incident.js";
import { createShadowProof } from "../src/repos/shadowProof.js";
import { createHomeostasis } from "../src/repos/homeostasis.js";

async function main() {
  await connectDb();
  await ensureTimeSeriesCollection();

  const now = new Date().toISOString();

  // intent_strand
  const strand = await createIntentStrand({
    moduleId: "shoplite/checkout",
    purpose: "Handle cart checkout: validate items, charge payment, create order record",
    invariants: [
      {
        id: "inv-1",
        rule: "Refunds above $100 require manager approval",
        rationale: "Fraud prevention and audit compliance",
        compliance: true,
      },
      {
        id: "inv-2",
        rule: "Payment must be idempotent using idempotency key",
        rationale: "Prevent double charges on network retry",
        compliance: false,
      },
    ],
    edgeDecisions: ["Partial refunds round down to cents", "Guest checkout uses ephemeral session"],
    sourcePrompt: "Build a checkout module for ShopLite with Supabase Postgres",
    generatedBy: { model: "qwen3.6-27b", version: "1.0" },
    pairing: { score: 0.94, lastChecked: now, unpairedInvariants: [] },
  });
  console.log(`intent_strand  _id=${strand._id}`);

  // vulnerability
  const vuln = await createVulnerability({
    class: "SQLi",
    endpoint: "/api/products/search",
    evidence: "query='; DROP TABLE products;-- returned 500 with SQL syntax error in response",
    reAttack: { before: "open", after: "open" },
    status: "open",
    detectedAt: now,
  });
  console.log(`vulnerability  _id=${vuln._id}`);

  // shadow_proof (needed before antibody references it)
  const proof = await createShadowProof({
    proofId: `proof-${Date.now()}`,
    changeRef: "patch/sqli-parameterized-query",
    replayedCases: 12,
    intendedFixPassed: true,
    regressions: 0,
    verdict: "promote",
    verifiedAt: now,
  });
  console.log(`shadow_proof   _id=${proof._id}`);

  // antibody
  const antibody = await createAntibody({
    antibodyId: `ab-${Date.now()}`,
    sourceType: "vuln",
    signature: "SQLi::/api/products/search::raw-string-concat",
    embedding: Array.from({ length: 8 }, (_, i) => (i + 1) * 0.1), // placeholder dims
    regressionTest: "test('SQLi blocked', () => { expect(search(\"' OR 1=1--\")).not.toContain('DROP') })",
    runtimeAssertion: "assert(typeof searchQuery === 'object', 'must use parameterized query')",
    mintedAt: now,
    recurrencesBlocked: 0,
  });
  console.log(`antibody       _id=${antibody._id}`);

  // entropy_timeseries
  const point = await createEntropyPoint({
    ts: now,
    temperature: 0.42,
    dims: {
      duplication: 0.35,
      patternVariance: 0.28,
      coupling: 0.51,
      vulnDensity: 0.18,
      comprehension: 0.76,
    },
    projectedRewriteWeeks: 18,
  });
  console.log(`entropy_timeseries _id=${point._id}`);

  // incident
  const incident = await createIncident({
    incidentId: `inc-${Date.now()}`,
    deployId: "deploy-abc123",
    detectedAt: now,
    baselineDelta: 4.7,
    causalChain: [
      { order: 1, description: "Deploy deploy-abc123 pushed at 00:47", evidenceRef: "git:abc123" },
      {
        order: 2,
        description: "POST /api/checkout triggered null from paymentClient.charge()",
        evidenceRef: "log:req-xyz",
      },
      {
        order: 3,
        description: "Unhandled null caused 500 on checkout route",
        evidenceRef: "log:err-uvw",
      },
    ],
    failingRequest: {
      method: "POST",
      path: "/api/checkout",
      body: { cartId: "cart-001", userId: "user-42" },
    },
    userImpactSeconds: 71,
  });
  console.log(`incident       _id=${incident._id}`);

  // homeostasis
  const homeostasis = await createHomeostasis({
    window: "24h",
    generationRate: 3.2,
    repairRate: 2.8,
    balance: -0.4,
    action: "reprioritise",
    hottestZones: ["shoplite/checkout", "shoplite/auth"],
  });
  console.log(`homeostasis    _id=${homeostasis._id}`);

  console.log("\nSeed complete ✓");
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
