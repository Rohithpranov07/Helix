import { NextResponse } from "next/server";
import {
  connectDb,
  listVulnerabilities,
  listIncidents,
  listEntropyPoints,
  listHomeostasis,
  listAntibodies,
} from "@helix/db";

export async function GET() {
  try {
    await connectDb();

    const [vulns, incidents, entropyPts, homeostasisDocs, antibodies] = await Promise.all([
      listVulnerabilities(),
      listIncidents(),
      listEntropyPoints(20),
      listHomeostasis(),
      listAntibodies(),
    ]);

    // Latest entropy point
    const latestEntropy = entropyPts[0] ?? null;

    // Vuln breakdown
    const openVulns = vulns.filter((v) => v.status === "open" || v.status === "patching");
    const healedVulns = vulns.filter((v) => v.status === "healed");

    const vulnByClass: Record<string, { open: number; healed: number }> = {};
    for (const v of vulns) {
      if (!vulnByClass[v.class]) vulnByClass[v.class] = { open: 0, healed: 0 };
      if (v.status === "open" || v.status === "patching") {
        vulnByClass[v.class]!.open++;
      } else {
        vulnByClass[v.class]!.healed++;
      }
    }

    // Recent incidents (last 5 by detectedAt desc)
    const sortedIncidents = [...incidents].sort(
      (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
    );
    const recentIncidents = sortedIncidents.slice(0, 5).map((i) => ({
      incidentId: i.incidentId,
      detectedAt: i.detectedAt,
      resolved: i.rollbackAt != null,
      rollbackAt: i.rollbackAt,
      userImpactSeconds: i.userImpactSeconds,
    }));

    // Latest homeostasis record
    const latestHomeostasis = homeostasisDocs.sort(
      (a, b) => (b._id > a._id ? 1 : -1),
    )[0] ?? null;

    // Antibody stats
    const totalBlocked = antibodies.reduce((sum, a) => sum + a.recurrencesBlocked, 0);

    // Entropy history for sparkline (last 10, oldest-first for chart order)
    const entropyHistory = [...entropyPts].reverse().slice(-10).map((p) => ({
      ts: p.ts,
      temperature: p.temperature,
    }));

    return NextResponse.json({
      snapshot: {
        ts: new Date().toISOString(),
        governor: latestHomeostasis,
        entropy: latestEntropy
          ? {
              temperature: latestEntropy.temperature,
              projectedRewriteWeeks: latestEntropy.projectedRewriteWeeks,
              dims: latestEntropy.dims,
              ts: latestEntropy.ts,
            }
          : null,
        entropyHistory,
        immune: {
          total: vulns.length,
          open: openVulns.length,
          healed: healedVulns.length,
          byClass: vulnByClass,
        },
        nervous: {
          total: incidents.length,
          resolved: incidents.filter((i) => i.rollbackAt != null).length,
          recent: recentIncidents,
        },
        memory: {
          antibodies: antibodies.length,
          recurrencesBlocked: totalBlocked,
        },
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "VITALS_ERROR", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
