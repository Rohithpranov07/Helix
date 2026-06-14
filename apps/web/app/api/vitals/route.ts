import { NextResponse } from "next/server";
import {
  connectDb,
  listVulnerabilities,
  listIncidents,
  listEntropyPoints,
  listHomeostasis,
  listAntibodies,
  listIntentStrands,
  listMetabolismRuns,
  listShadowProofs,
} from "@helix/db";

export async function GET() {
  try {
    await connectDb();

    const [vulns, incidents, entropyPts, homeostasisDocs, antibodies, strands, metabolismRuns, shadowProofs] = await Promise.all([
      listVulnerabilities(),
      listIncidents(),
      listEntropyPoints(20),
      listHomeostasis(),
      listAntibodies(),
      listIntentStrands(),
      listMetabolismRuns(),
      listShadowProofs(),
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

    // Latest homeostasis record — sort descending by _id (ObjectId lexicographic = insertion order)
    const latestHomeostasis = [...homeostasisDocs].sort(
      (a, b) => (a._id < b._id ? 1 : a._id > b._id ? -1 : 0),
    )[0] ?? null;

    // Antibody stats
    const totalBlocked = antibodies.reduce((sum, a) => sum + a.recurrencesBlocked, 0);

    // Entropy history for sparkline (last 10, oldest-first for chart order)
    const entropyHistory = [...entropyPts].reverse().slice(-10).map((p) => ({
      ts: p.ts,
      temperature: p.temperature,
    }));

    // Heart rate — incident velocity over last 24h; deploy count from Railway when token is set
    const since24h = Date.now() - 24 * 60 * 60 * 1000;
    const incidentsLast24h = incidents.filter(
      (i) => new Date(i.detectedAt).getTime() > since24h,
    ).length;

    let deploysPerDay = 0;
    if (process.env["RAILWAY_API_TOKEN"]) {
      try {
        const { fetchProjects, fetchDeployments } = await import("@helix/engine/src/nervous/railway.js");
        const projects = await fetchProjects();
        const deployCountsSettled = await Promise.allSettled(
          projects.map((p) => fetchDeployments(p.id, 20)),
        );
        const recentDeploys = deployCountsSettled.flatMap((r) =>
          r.status === "fulfilled" ? r.value : [],
        ).filter((d) => new Date(d.createdAt).getTime() > since24h);
        deploysPerDay = recentDeploys.length;
      } catch {
        deploysPerDay = 0;
      }
    }

    const heartRate = {
      incidentsPerDay: incidentsLast24h,
      deploysPerDay,
    };

    // Genetic integrity — intent–code pairing across modules
    const pairedStrands = strands.filter((s) => s.pairing.score >= 0.8).length;
    const avgPairingScore =
      strands.length > 0
        ? strands.reduce((sum, s) => sum + s.pairing.score, 0) / strands.length
        : null;
    const totalUnpaired = strands.reduce((sum, s) => sum + s.pairing.unpairedInvariants.length, 0);
    const genome = {
      modules: strands.length,
      paired: pairedStrands,
      avgScore: avgPairingScore != null ? Math.round(avgPairingScore * 100) / 100 : null,
      totalUnpaired,
      pairingPct: strands.length > 0 ? Math.round((pairedStrands / strands.length) * 100) : null,
    };

    // Metabolism stats
    const latestMetabolismRun = metabolismRuns[0] ?? null;
    const metabolismStats = {
      runs: metabolismRuns.length,
      lastTemp: latestMetabolismRun?.temperature ?? null,
      projectedWeeks: latestMetabolismRun?.projectedRewriteWeeks ?? null,
    };

    // Shadow proof stats
    const promotedProofs = shadowProofs.filter((p) => p.verdict === "promote").length;
    const rejectedProofs = shadowProofs.filter((p) => p.verdict === "reject").length;
    const shadowStats = {
      total: shadowProofs.length,
      promoted: promotedProofs,
      rejected: rejectedProofs,
    };

    // Recent shadow proofs (last 10, sorted by verifiedAt desc)
    const recentShadowProofs = [...shadowProofs]
      .sort((a, b) => new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime())
      .slice(0, 10)
      .map((p) => ({
        proofId: p.proofId,
        changeRef: p.changeRef,
        verdict: p.verdict,
        verifiedAt: p.verifiedAt,
        replayedCases: p.replayedCases,
        intendedFixPassed: p.intendedFixPassed,
        regressions: p.regressions,
      }));

    return NextResponse.json({
      snapshot: {
        ts: new Date().toISOString(),
        governor: latestHomeostasis,
        metabolism: metabolismStats,
        shadow: shadowStats,
        recentShadowProofs,
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
        genome,
        heartRate,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "VITALS_ERROR", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
