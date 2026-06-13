"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types mirroring /api/vitals response ──────────────────────────────────────

interface EntropyDims {
  duplication: number;
  patternVariance: number;
  coupling: number;
  vulnDensity: number;
  comprehension: number;
}

interface EntropySnapshot {
  temperature: number;
  projectedRewriteWeeks: number;
  dims: EntropyDims;
  ts: string;
}

interface GovernorSnapshot {
  window: string;
  generationRate: number;
  repairRate: number;
  balance: number;
  action: "ok" | "reprioritise" | "gate";
  hottestZones: string[];
}

interface ImmuneSnapshot {
  total: number;
  open: number;
  healed: number;
  byClass: Record<string, { open: number; healed: number }>;
}

interface RecentIncident {
  incidentId: string;
  detectedAt: string;
  resolved: boolean;
  rollbackAt?: string;
  userImpactSeconds: number;
}

interface NervousSnapshot {
  total: number;
  resolved: number;
  recent: RecentIncident[];
}

interface MemorySnapshot {
  antibodies: number;
  recurrencesBlocked: number;
}

interface VitalsSnapshot {
  ts: string;
  governor: GovernorSnapshot | null;
  entropy: EntropySnapshot | null;
  entropyHistory: Array<{ ts: string; temperature: number }>;
  immune: ImmuneSnapshot;
  nervous: NervousSnapshot;
  memory: MemorySnapshot;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tempColor(t: number): string {
  if (t >= 0.8) return "#ef4444";
  if (t >= 0.5) return "#f97316";
  if (t >= 0.3) return "#eab308";
  return "#22c55e";
}

function actionColor(action: string): string {
  if (action === "gate") return "#ef4444";
  if (action === "reprioritise") return "#f97316";
  return "#22c55e";
}

function actionLabel(action: string): string {
  if (action === "gate") return "GATE";
  if (action === "reprioritise") return "REPRIORITISE";
  return "OK";
}

function fmtAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function fmtImpact(secs: number): string {
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function MiniBar({ value, max = 1, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ background: "#1e293b", borderRadius: 4, height: 8, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.4s" }} />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: 12,
      padding: "20px 24px",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#64748b", textTransform: "uppercase", marginBottom: 16 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Sparkline({ data }: { data: Array<{ ts: string; temperature: number }> }) {
  if (data.length < 2) return <div style={{ color: "#475569", fontSize: 12 }}>not enough history</div>;
  const W = 240, H = 48, PAD = 4;
  const vals = data.map((d) => d.temperature);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals, 0.01);
  const pts = vals.map((v, i) => {
    const x = PAD + (i / (vals.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - minV) / (maxV - minV)) * (H - PAD * 2);
    return `${x},${y}`;
  });
  const last = vals[vals.length - 1] ?? 0;
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={tempColor(last)} strokeWidth={2} />
      {pts.length > 0 && (
        <circle
          cx={Number(pts[pts.length - 1]!.split(",")[0])}
          cy={Number(pts[pts.length - 1]!.split(",")[1])}
          r={3}
          fill={tempColor(last)}
        />
      )}
    </svg>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState<VitalsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [fetching, setFetching] = useState(false);

  const fetchVitals = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/vitals");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { snapshot: VitalsSnapshot };
      setSnapshot(json.snapshot);
      setLastFetch(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    void fetchVitals();
    const timer = setInterval(() => { void fetchVitals(); }, 30_000);
    return () => clearInterval(timer);
  }, [fetchVitals]);

  const g = snapshot?.governor;
  const e = snapshot?.entropy;
  const im = snapshot?.immune;
  const nv = snapshot?.nervous;
  const mem = snapshot?.memory;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#020617",
      color: "#e2e8f0",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1e293b",
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: snapshot ? "#22c55e" : "#475569",
            boxShadow: snapshot ? "0 0 8px #22c55e" : "none",
          }} />
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>HELIX</span>
          <span style={{ color: "#475569", fontSize: 14 }}>Vital Signs</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "#475569" }}>
          {fetching && <span style={{ color: "#64748b" }}>refreshing...</span>}
          {lastFetch && <span>last update: {fmtAgo(lastFetch.toISOString())}</span>}
          <button
            onClick={() => { void fetchVitals(); }}
            style={{
              background: "#1e293b", border: "1px solid #334155",
              color: "#94a3b8", borderRadius: 6, padding: "4px 12px",
              cursor: "pointer", fontSize: 12,
            }}
          >
            refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#450a0a", borderBottom: "1px solid #7f1d1d", padding: "10px 32px", fontSize: 13, color: "#fca5a5" }}>
          Error fetching vitals: {error}
        </div>
      )}

      {!snapshot && !error && (
        <div style={{ padding: 64, textAlign: "center", color: "#475569" }}>Loading vitals...</div>
      )}

      {snapshot && (
        <div style={{ padding: "24px 32px", display: "grid", gap: 20 }}>

          {/* Governor — full width */}
          <Card title="Governor — Homeostasis">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{
                  padding: "10px 24px",
                  borderRadius: 8,
                  background: g ? `${actionColor(g.action)}18` : "#1e293b",
                  border: `2px solid ${g ? actionColor(g.action) : "#334155"}`,
                  fontSize: 22, fontWeight: 800, letterSpacing: "0.06em",
                  color: g ? actionColor(g.action) : "#475569",
                }}>
                  {g ? actionLabel(g.action) : "—"}
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>balance</div>
                  <div style={{
                    fontSize: 28, fontWeight: 700,
                    color: g && g.balance >= 0 ? "#22c55e" : "#ef4444",
                  }}>
                    {g ? `${g.balance >= 0 ? "+" : ""}${g.balance}` : "—"}
                  </div>
                  {g && (
                    <div style={{ fontSize: 11, color: "#475569" }}>
                      {g.repairRate} healed / {g.generationRate} generated ({g.window})
                    </div>
                  )}
                </div>
              </div>
              {g && g.hottestZones.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>hottest zones</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {g.hottestZones.map((z) => (
                      <div key={z} style={{
                        fontSize: 12, fontFamily: "monospace",
                        background: "#1e293b", borderRadius: 4,
                        padding: "2px 8px", color: "#f97316",
                      }}>
                        {z}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Entropy + Immune */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Card title="Metabolism — Entropy">
              <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 48, fontWeight: 800, color: e ? tempColor(e.temperature) : "#475569", lineHeight: 1 }}>
                    {e ? e.temperature.toFixed(3) : "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>temperature</div>
                  {e && (
                    <div style={{ marginTop: 8, fontSize: 13, color: "#94a3b8" }}>
                      rewrite cliff in{" "}
                      <span style={{ fontWeight: 600, color: e.projectedRewriteWeeks < 10 ? "#ef4444" : "#94a3b8" }}>
                        {e.projectedRewriteWeeks}w
                      </span>
                    </div>
                  )}
                  {e && <div style={{ marginTop: 4, fontSize: 11, color: "#475569" }}>measured {fmtAgo(e.ts)}</div>}
                </div>
                {e && (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    {(Object.entries(e.dims) as Array<[string, number]>).map(([dim, val]) => (
                      <div key={dim}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 11, color: "#64748b" }}>
                          <span>{dim}</span><span>{val.toFixed(2)}</span>
                        </div>
                        <MiniBar value={val} color={tempColor(val)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {snapshot.entropyHistory.length >= 2 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>temperature history</div>
                  <Sparkline data={snapshot.entropyHistory} />
                </div>
              )}
            </Card>

            <Card title="Immune System — Vulnerabilities">
              {im ? (
                <>
                  <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
                    {[["open", im.open, im.open > 0 ? "#ef4444" : "#22c55e"], ["healed", im.healed, "#22c55e"], ["total", im.total, "#94a3b8"]].map(([label, val, color]) => (
                      <div key={String(label)}>
                        <div style={{ fontSize: 40, fontWeight: 800, color: String(color) }}>{String(val)}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{String(label)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {Object.entries(im.byClass).map(([cls, counts]) => (
                      <div key={cls} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 80, fontSize: 12, fontFamily: "monospace", color: "#94a3b8" }}>{cls}</div>
                        <div style={{ flex: 1 }}>
                          <MiniBar value={counts.open} max={Math.max(im.total, 1)} color="#ef4444" />
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
                          {counts.open} open / {counts.healed} healed
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : <div style={{ color: "#475569" }}>no data</div>}
            </Card>
          </div>

          {/* Nervous + Memory */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
            <Card title="Nervous System — Incidents">
              {nv ? (
                <>
                  <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
                    {[["total", nv.total, "#94a3b8"], ["resolved", nv.resolved, "#22c55e"], ["open", nv.total - nv.resolved, nv.total - nv.resolved > 0 ? "#f97316" : "#22c55e"]].map(([label, val, color]) => (
                      <div key={String(label)}>
                        <div style={{ fontSize: 40, fontWeight: 800, color: String(color) }}>{String(val)}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{String(label)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {nv.recent.map((inc) => (
                      <div key={inc.incidentId} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: "#1e293b", borderRadius: 6, padding: "8px 12px",
                        borderLeft: `3px solid ${inc.resolved ? "#22c55e" : "#f97316"}`,
                      }}>
                        <div>
                          <div style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8" }}>{inc.incidentId}</div>
                          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                            impact: {fmtImpact(inc.userImpactSeconds)} · {fmtAgo(inc.detectedAt)}
                          </div>
                        </div>
                        <div style={{
                          fontSize: 10, fontWeight: 600, letterSpacing: "0.05em",
                          color: inc.resolved ? "#22c55e" : "#f97316",
                          background: inc.resolved ? "#052e16" : "#431407",
                          padding: "2px 8px", borderRadius: 4,
                        }}>
                          {inc.resolved ? "RESOLVED" : "OPEN"}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : <div style={{ color: "#475569" }}>no data</div>}
            </Card>

            <Card title="Immune Memory — Antibodies">
              {mem ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 48, fontWeight: 800, color: "#818cf8" }}>{mem.antibodies}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>antibodies minted</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 36, fontWeight: 700, color: "#22c55e" }}>{mem.recurrencesBlocked}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>recurrences blocked</div>
                  </div>
                  {mem.antibodies > 0 && (
                    <div>
                      <MiniBar value={mem.recurrencesBlocked} max={Math.max(mem.recurrencesBlocked, mem.antibodies)} color="#818cf8" />
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                        {(mem.recurrencesBlocked / mem.antibodies).toFixed(1)} blocked/antibody avg
                      </div>
                    </div>
                  )}
                </div>
              ) : <div style={{ color: "#475569" }}>no data</div>}
            </Card>
          </div>

          <div style={{ textAlign: "center", fontSize: 11, color: "#334155", paddingBottom: 8 }}>
            HELIX autonomous living layer · auto-refreshes every 30s
            {snapshot.ts && ` · snapshot at ${new Date(snapshot.ts).toLocaleTimeString()}`}
          </div>
        </div>
      )}
    </div>
  );
}
