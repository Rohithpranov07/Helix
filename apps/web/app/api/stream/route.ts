/**
 * T8.2 — SSE activity stream
 * GET /api/stream → text/event-stream
 * Sends live organ activity events: scans, heals, incidents, antibodies, entropy readings.
 * Polls MongoDB every 5 s for new docs; initial burst covers the last 10 minutes.
 */
import {
  connectDb,
  listVulnerabilities,
  listIncidents,
  listAntibodies,
  listEntropyPoints,
  listHomeostasis,
} from "@helix/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ActivityEvent {
  type:
    | "vuln_detected"
    | "vuln_healed"
    | "incident_open"
    | "incident_resolved"
    | "antibody_minted"
    | "entropy_measured"
    | "governor_check"
    | "heartbeat";
  ts: string;
  message: string;
  detail?: string | undefined;
}

function isoRecent(isoStr: string, since: Date): boolean {
  return new Date(isoStr).getTime() >= since.getTime();
}

async function collectEvents(since: Date): Promise<ActivityEvent[]> {
  const [vulns, incidents, antibodies, entropyPts, homeostasis] = await Promise.all([
    listVulnerabilities(),
    listIncidents(),
    listAntibodies(),
    listEntropyPoints(5),
    listHomeostasis(),
  ]);

  const events: ActivityEvent[] = [];

  for (const v of vulns) {
    if (isoRecent(v.detectedAt, since)) {
      events.push({
        type: "vuln_detected",
        ts: v.detectedAt,
        message: `🔴 ${v.class} detected on ${v.endpoint}`,
        detail: v.evidence.slice(0, 120),
      });
    }
    if (v.healedAt && isoRecent(v.healedAt, since)) {
      events.push({
        type: "vuln_healed",
        ts: v.healedAt,
        message: `✅ ${v.class} healed — re-attack: closed · antibody ${v.antibodyId ?? "minted"}`,
        detail: v.patchRef,
      });
    }
  }

  for (const i of incidents) {
    if (isoRecent(i.detectedAt, since)) {
      events.push({
        type: "incident_open",
        ts: i.detectedAt,
        message: `⚡ Incident ${i.incidentId} — deploy ${i.deployId} · Δ${i.baselineDelta.toFixed(2)}`,
        detail: i.rollbackAt ? `rolled back at ${i.rollbackAt}` : "awaiting rollback",
      });
    }
    if (i.rollbackAt && isoRecent(i.rollbackAt, since)) {
      const impact = i.userImpactSeconds;
      events.push({
        type: "incident_resolved",
        ts: i.rollbackAt,
        message: `💚 resolved ${impact}s · ${i.fixRef ? "fix promoted" : "rolled back"} · antibody ${i.antibodyId ?? "—"}`,
        detail: i.incidentId,
      });
    }
  }

  for (const a of antibodies) {
    if (isoRecent(a.mintedAt, since)) {
      events.push({
        type: "antibody_minted",
        ts: a.mintedAt,
        message: `🧬 Antibody ${a.antibodyId} minted (${a.sourceType})`,
        detail: a.signature.slice(0, 80),
      });
    }
  }

  for (const p of entropyPts) {
    if (isoRecent(p.ts, since)) {
      events.push({
        type: "entropy_measured",
        ts: p.ts,
        message: `🌡️ Entropy temperature ${p.temperature.toFixed(3)} · rewrite in ${p.projectedRewriteWeeks}w`,
      });
    }
  }

  for (const h of homeostasis) {
    // homeostasis docs don't have explicit ts — skip timestamp filtering, include all recent by _id insertion order
    void h;
  }

  return events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
}

import { withRateLimit, LIMITS } from "@/lib/apiRateLimit";

const handler = async (request: Request) => {
  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: ActivityEvent) => {
        if (signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        } catch {
          // controller already closed
        }
      };

      try {
        await connectDb();
      } catch {
        // DB unavailable — still open the stream, heartbeats only
      }

      // Initial burst: last 10 minutes
      const initial = await collectEvents(new Date(Date.now() - 10 * 60 * 1000)).catch(() => []);
      for (const ev of initial) send(ev);

      let lastPoll = new Date();

      const poll = setInterval(async () => {
        if (signal.aborted) {
          clearInterval(poll);
          try { controller.close(); } catch { /* already closed */ }
          return;
        }
        const since = lastPoll;
        lastPoll = new Date();
        const newEvents = await collectEvents(since).catch(() => []);
        for (const ev of newEvents) send(ev);

        // Heartbeat keeps connection alive and signals the stream is healthy
        send({ type: "heartbeat", ts: new Date().toISOString(), message: "♡ alive" });
      }, 5_000);

      signal.addEventListener("abort", () => {
        clearInterval(poll);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
};

export const GET = withRateLimit(LIMITS.SSE, handler as (req: import("next/server").NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>);
