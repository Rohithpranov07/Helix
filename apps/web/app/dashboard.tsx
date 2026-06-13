"use client";

import { useEffect, useState, useCallback, useRef } from "react";

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

interface GenomeSnapshot {
  modules: number;
  paired: number;
  avgScore: number | null;
  totalUnpaired: number;
  pairingPct: number | null;
}

interface HeartRateSnapshot {
  incidentsPerDay: number;
  deploysPerDay: number;
}

interface VitalsSnapshot {
  ts: string;
  governor: GovernorSnapshot | null;
  entropy: EntropySnapshot | null;
  entropyHistory: Array<{ ts: string; temperature: number }>;
  immune: ImmuneSnapshot;
  nervous: NervousSnapshot;
  memory: MemorySnapshot;
  genome: GenomeSnapshot;
  heartRate: HeartRateSnapshot;
}

interface StreamEvent {
  type: string;
  ts: string;
  message: string;
  detail?: string;
}

interface GitHubConnection {
  owner: string;
  repo: string;
  defaultBranch: string;
  connectedAt: string;
}

interface DriftMismatch {
  invariantId: string;
  description: string;
  affectedFile: string;
  diff: string;
  newContent: string;
}

interface DriftReport {
  driftId: string;
  strandId: string;
  githubOwner: string;
  githubRepo: string;
  shadowBranch: string;
  detectedAt: string;
  mismatches: DriftMismatch[];
  status: "pending_approval" | "approved" | "rejected" | "pr_created";
  prUrl?: string;
  prNumber?: number;
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

// ── Voice briefing helpers ────────────────────────────────────────────────────

function playBase64Audio(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  void audio.play();
}

interface VoiceState {
  loading: boolean;
  text: string | null;
  error: string | null;
}

function IncidentVoicePanel({ incidentId }: { incidentId: string }) {
  const [report, setReport] = useState<VoiceState>({ loading: false, text: null, error: null });
  const [ask, setAsk] = useState<{ transcript: string; answer: string } | null>(null);
  const [recording, setRecording] = useState(false);

  async function fetchReport() {
    setReport({ loading: true, text: null, error: null });
    try {
      const res = await fetch("/api/voice/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      });
      const json = (await res.json()) as { text?: string; audio?: string | null; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      if (json.audio) playBase64Audio(json.audio);
      setReport({ loading: false, text: json.text ?? null, error: null });
    } catch (e) {
      setReport({ loading: false, text: null, error: e instanceof Error ? e.message : "failed" });
    }
  }

  async function startAsk() {
    if (!navigator.mediaDevices) return;
    setRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/wav" });
        const buf = await blob.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const res = await fetch("/api/voice/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ incidentId, audio: b64 }),
        });
        const json = (await res.json()) as { transcript?: string; answer?: string; audio?: string | null };
        if (json.audio) playBase64Audio(json.audio);
        setAsk({ transcript: json.transcript ?? "", answer: json.answer ?? "" });
        setRecording(false);
      };
      recorder.start();
      setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 5000);
    } catch {
      setRecording(false);
    }
  }

  const btnStyle: React.CSSProperties = {
    fontSize: 11, padding: "3px 8px", borderRadius: 4, border: "1px solid #334155",
    background: "#1e293b", color: "#94a3b8", cursor: "pointer", marginRight: 4,
  };

  return (
    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
      <div>
        <button style={btnStyle} onClick={() => { void fetchReport(); }} disabled={report.loading}>
          {report.loading ? "…" : "▶ Briefing"}
        </button>
        <button style={btnStyle} onClick={() => { void startAsk(); }} disabled={recording}>
          {recording ? "● Recording…" : "🎤 Ask"}
        </button>
      </div>
      {report.text && <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>{report.text}</div>}
      {report.error && <div style={{ fontSize: 11, color: "#ef4444" }}>{report.error}</div>}
      {ask && (
        <div style={{ fontSize: 11, color: "#94a3b8" }}>
          <span style={{ color: "#475569" }}>Q: </span>{ask.transcript}<br />
          <span style={{ color: "#475569" }}>A: </span>{ask.answer}
        </div>
      )}
    </div>
  );
}

// ── GitHub Genome Panel ────────────────────────────────────────────────────────

function GenomePanel() {
  const [connections, setConnections] = useState<GitHubConnection[]>([]);
  const [drifts, setDrifts] = useState<DriftReport[]>([]);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [intentDocs, setIntentDocs] = useState("");
  const [selectedConn, setSelectedConn] = useState<string | null>(null); // "owner/repo"
  const [indexing, setIndexing] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [indexResult, setIndexResult] = useState<string | null>(null);
  const [acting, setActing] = useState<Set<string>>(new Set());
  const [panelError, setPanelError] = useState<string | null>(null);
  const [connError, setConnError] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/github/connections");
      const json = (await res.json()) as { connections?: GitHubConnection[]; error?: string };
      if (json.connections) setConnections(json.connections);
    } catch { /* ignore */ }
  }, []);

  const loadDrifts = useCallback(async (o: string, r: string) => {
    try {
      const res = await fetch(`/api/reflex/genome-drifts?owner=${encodeURIComponent(o)}&repo=${encodeURIComponent(r)}`);
      const json = (await res.json()) as { reports?: DriftReport[] };
      if (json.reports) setDrifts(json.reports);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void loadConnections();
    // Check URL for github_connected / error params
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("github_connected");
    if (connected) {
      const parts = connected.split("/");
      if (parts.length === 2) {
        const [o, r] = parts as [string, string];
        setOwner(o);
        setRepo(r);
        setSelectedConn(connected);
        void loadDrifts(o, r);
      }
      // clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    const err = params.get("error");
    if (err) {
      setConnError(decodeURIComponent(err));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [loadConnections, loadDrifts]);

  function connectOAuth() {
    if (!owner.trim() || !repo.trim()) {
      setPanelError("Enter owner and repo before connecting.");
      return;
    }
    window.location.href = `/api/auth/github?owner=${encodeURIComponent(owner.trim())}&repo=${encodeURIComponent(repo.trim())}`;
  }

  async function selectRepo(conn: GitHubConnection) {
    setSelectedConn(`${conn.owner}/${conn.repo}`);
    setOwner(conn.owner);
    setRepo(conn.repo);
    setIndexResult(null);
    setPanelError(null);
    setDrifts([]);
    await loadDrifts(conn.owner, conn.repo);
  }

  async function runIndex() {
    if (!selectedConn) return;
    setIndexing(true);
    setPanelError(null);
    setIndexResult(null);
    try {
      const docPaths = intentDocs.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await fetch("/api/reflex/genome-index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, intentDocs: docPaths }),
      });
      const json = (await res.json()) as { indexed?: number; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      setIndexResult(`Indexed ${json.indexed ?? 0} modules into intent strands.`);
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "indexing failed");
    } finally {
      setIndexing(false);
    }
  }

  async function runDrift() {
    if (!selectedConn) return;
    setDetecting(true);
    setPanelError(null);
    try {
      const res = await fetch("/api/reflex/genome-drift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo }),
      });
      const json = (await res.json()) as { report?: DriftReport; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.report) {
        setDrifts((prev) => {
          const next = [json.report!, ...prev.filter((d) => d.driftId !== json.report!.driftId)];
          return next;
        });
      }
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "drift detection failed");
    } finally {
      setDetecting(false);
    }
  }

  async function approve(driftId: string) {
    setActing((s) => new Set(s).add(driftId));
    try {
      const res = await fetch("/api/reflex/genome-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driftId }),
      });
      const json = (await res.json()) as { prUrl?: string; prNumber?: number; report?: DriftReport; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.report) {
        setDrifts((prev) => prev.map((d) => d.driftId === driftId ? json.report! : d));
      }
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "approve failed");
    } finally {
      setActing((s) => { const n = new Set(s); n.delete(driftId); return n; });
    }
  }

  async function reject(driftId: string) {
    setActing((s) => new Set(s).add(driftId));
    try {
      const res = await fetch("/api/reflex/genome-reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driftId }),
      });
      const json = (await res.json()) as { driftId?: string; status?: string; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      setDrifts((prev) => prev.map((d) => d.driftId === driftId ? { ...d, status: "rejected" as const } : d));
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "reject failed");
    } finally {
      setActing((s) => { const n = new Set(s); n.delete(driftId); return n; });
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "#0f172a", border: "1px solid #334155", borderRadius: 6,
    color: "#e2e8f0", padding: "6px 10px", fontSize: 13, outline: "none",
    width: "100%", boxSizing: "border-box",
  };
  const btnPrimary: React.CSSProperties = {
    background: "#1e40af", border: "none", borderRadius: 6, color: "#e2e8f0",
    padding: "7px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600,
  };
  const btnSecondary: React.CSSProperties = {
    background: "#1e293b", border: "1px solid #334155", borderRadius: 6,
    color: "#94a3b8", padding: "6px 12px", fontSize: 12, cursor: "pointer",
  };
  const btnDanger: React.CSSProperties = {
    background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 6,
    color: "#fca5a5", padding: "5px 10px", fontSize: 12, cursor: "pointer",
  };
  const btnSuccess: React.CSSProperties = {
    background: "#052e16", border: "1px solid #14532d", borderRadius: 6,
    color: "#86efac", padding: "5px 10px", fontSize: 12, cursor: "pointer",
  };

  const statusColor = (s: string) => {
    if (s === "pending_approval") return "#f97316";
    if (s === "approved" || s === "pr_created") return "#22c55e";
    if (s === "rejected") return "#ef4444";
    return "#94a3b8";
  };

  return (
    <Card title="Genome — GitHub Repository Monitor">
      {connError && (
        <div style={{ background: "#450a0a", borderRadius: 6, padding: "8px 12px", color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>
          OAuth error: {connError}
        </div>
      )}

      {/* Connect Form */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>GitHub Owner</div>
          <input style={inputStyle} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="octocat" />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Repository</div>
          <input style={inputStyle} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="my-repo" />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Intent doc paths (comma-sep)</div>
          <input style={inputStyle} value={intentDocs} onChange={(e) => setIntentDocs(e.target.value)} placeholder="docs/PRD.md,ARCHITECTURE.md" />
        </div>
        <button style={btnPrimary} onClick={connectOAuth}>Connect via GitHub</button>
      </div>

      {/* Connected repos */}
      {connections.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Connected repositories</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {connections.map((c) => {
              const key = `${c.owner}/${c.repo}`;
              const isSelected = selectedConn === key;
              return (
                <button
                  key={key}
                  style={{
                    ...btnSecondary,
                    border: isSelected ? "1px solid #3b82f6" : "1px solid #334155",
                    color: isSelected ? "#93c5fd" : "#94a3b8",
                  }}
                  onClick={() => { void selectRepo(c); }}
                >
                  {key}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions for selected repo */}
      {selectedConn && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
            Active: <span style={{ color: "#3b82f6", fontFamily: "monospace" }}>{selectedConn}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnSecondary} onClick={() => { void runIndex(); }} disabled={indexing}>
              {indexing ? "Indexing…" : "Index Repository"}
            </button>
            <button style={btnSecondary} onClick={() => { void runDrift(); }} disabled={detecting}>
              {detecting ? "Detecting…" : "Detect Drift"}
            </button>
            <button style={btnSecondary} onClick={() => { void loadDrifts(owner, repo); }}>
              Refresh Drift Reports
            </button>
          </div>
          {indexResult && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#86efac", background: "#052e16", borderRadius: 6, padding: "6px 10px" }}>
              {indexResult}
            </div>
          )}
        </div>
      )}

      {panelError && (
        <div style={{ background: "#450a0a", borderRadius: 6, padding: "8px 12px", color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>
          {panelError}
        </div>
      )}

      {/* Drift Reports */}
      {drifts.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
            Drift reports — {drifts.filter((d) => d.status === "pending_approval").length} pending approval
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {drifts.map((d) => (
              <div key={d.driftId} style={{
                background: "#1e293b", borderRadius: 8, padding: "12px 16px",
                borderLeft: `3px solid ${statusColor(d.status)}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8" }}>
                      {d.driftId}
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                      detected {fmtAgo(d.detectedAt)} · shadow branch:{" "}
                      <span style={{ fontFamily: "monospace", color: "#64748b" }}>{d.shadowBranch}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>
                      {d.mismatches.length} mismatch{d.mismatches.length !== 1 ? "es" : ""}:{" "}
                      {d.mismatches.map((m) => m.invariantId).join(", ")}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                      color: statusColor(d.status),
                      padding: "2px 8px", borderRadius: 4,
                      background: `${statusColor(d.status)}18`,
                    }}>
                      {d.status.replace("_", " ").toUpperCase()}
                    </span>
                    {d.status === "pending_approval" && (
                      <>
                        <button
                          style={btnSuccess}
                          disabled={acting.has(d.driftId)}
                          onClick={() => { void approve(d.driftId); }}
                        >
                          {acting.has(d.driftId) ? "…" : "Approve & Create PR"}
                        </button>
                        <button
                          style={btnDanger}
                          disabled={acting.has(d.driftId)}
                          onClick={() => { void reject(d.driftId); }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {d.status === "pr_created" && d.prUrl && (
                      <a
                        href={d.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...btnSuccess, textDecoration: "none", fontSize: 12 }}
                      >
                        View PR #{d.prNumber}
                      </a>
                    )}
                  </div>
                </div>
                {/* Mismatch details */}
                {d.mismatches.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {d.mismatches.map((m) => (
                      <div key={m.invariantId} style={{
                        background: "#0f172a", borderRadius: 6, padding: "8px 12px",
                        fontSize: 11, color: "#94a3b8",
                      }}>
                        <span style={{ color: "#f97316", fontFamily: "monospace" }}>[{m.invariantId}]</span>{" "}
                        {m.description}{" "}
                        <span style={{ color: "#475569" }}>→ {m.affectedFile}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedConn && drifts.length === 0 && (
        <div style={{ color: "#475569", fontSize: 13 }}>
          No drift reports for {selectedConn}. Index the repo then run "Detect Drift".
        </div>
      )}

      {!selectedConn && connections.length === 0 && (
        <div style={{ color: "#475569", fontSize: 13 }}>
          Enter owner + repo above and click "Connect via GitHub" to authenticate HELIX with your repository.
        </div>
      )}
    </Card>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState<VitalsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [fetching, setFetching] = useState(false);
  const [activity, setActivity] = useState<StreamEvent[]>([]);
  const activityRef = useRef<HTMLDivElement>(null);

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

  // SSE activity stream
  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as StreamEvent;
        if (data.type === "heartbeat") return;
        setActivity((prev) => {
          const next = [data, ...prev].slice(0, 40);
          return next;
        });
        // auto-scroll to top (newest first)
        if (activityRef.current) activityRef.current.scrollTop = 0;
      } catch { /* ignore */ }
    };
    es.onerror = () => { /* reconnects automatically */ };
    return () => { es.close(); };
  }, []);

  const g = snapshot?.governor;
  const e = snapshot?.entropy;
  const im = snapshot?.immune;
  const nv = snapshot?.nervous;
  const mem = snapshot?.memory;
  const gen = snapshot?.genome;
  const hr = snapshot?.heartRate;

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
                        background: "#1e293b", borderRadius: 6, padding: "8px 12px",
                        borderLeft: `3px solid ${inc.resolved ? "#22c55e" : "#f97316"}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                        {inc.resolved && <IncidentVoicePanel incidentId={inc.incidentId} />}
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

          {/* Genetic Integrity + Heart Rate + Lifeline */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>

            <Card title="Genome — Genetic Integrity">
              {gen ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                    <div style={{
                      fontSize: 48, fontWeight: 800, lineHeight: 1,
                      color: gen.pairingPct == null ? "#475569"
                        : gen.pairingPct >= 80 ? "#22c55e"
                        : gen.pairingPct >= 50 ? "#f97316" : "#ef4444",
                    }}>
                      {gen.pairingPct != null ? `${gen.pairingPct}%` : "—"}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", paddingBottom: 6 }}>paired</div>
                  </div>
                  <MiniBar
                    value={gen.pairingPct ?? 0}
                    max={100}
                    color={
                      (gen.pairingPct ?? 0) >= 80 ? "#22c55e"
                      : (gen.pairingPct ?? 0) >= 50 ? "#f97316" : "#ef4444"
                    }
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
                      <span>modules tracked</span><span style={{ color: "#e2e8f0" }}>{gen.modules}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
                      <span>avg pairing score</span>
                      <span style={{ color: "#e2e8f0" }}>{gen.avgScore != null ? gen.avgScore.toFixed(2) : "—"}</span>
                    </div>
                    {gen.totalUnpaired > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#f97316" }}>
                        <span>unpaired invariants</span><span>{gen.totalUnpaired}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ color: "#475569", fontSize: 13 }}>
                  no intent strands — run{" "}
                  <code style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>
                    pnpm --filter engine seed:shoplite
                  </code>
                </div>
              )}
            </Card>

            <Card title="Heart Rate — Deploy Velocity">
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 40, fontWeight: 800, color: "#38bdf8" }}>
                      {hr?.deploysPerDay ?? "—"}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>deploys / day</div>
                  </div>
                  <div>
                    <div style={{
                      fontSize: 40, fontWeight: 800,
                      color: (hr?.incidentsPerDay ?? 0) > 0 ? "#f97316" : "#22c55e",
                    }}>
                      {hr?.incidentsPerDay ?? "—"}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>incidents / day</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#475569" }}>
                  {nv && nv.total > 0
                    ? `${nv.resolved}/${nv.total} incidents resolved all-time`
                    : "no incidents recorded"}
                </div>
                {nv && nv.total > 0 && (
                  <div>
                    <MiniBar
                      value={nv.resolved}
                      max={nv.total}
                      color="#22c55e"
                    />
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>
                      {Math.round((nv.resolved / nv.total) * 100)}% resolution rate
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card title="Lifeline — Health Projection">
              {e ? (() => {
                const weeks = e.projectedRewriteWeeks;
                const isGreen = weeks >= 20;
                const isYellow = weeks >= 10 && weeks < 20;
                const color = isGreen ? "#22c55e" : isYellow ? "#eab308" : "#ef4444";
                const label = isGreen ? "THRIVING" : isYellow ? "WATCH" : "CRITICAL";
                const pct = Math.min(100, (weeks / 52) * 100);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{
                      padding: "8px 16px", borderRadius: 8, textAlign: "center",
                      background: `${color}18`, border: `2px solid ${color}`,
                      fontSize: 20, fontWeight: 800, letterSpacing: "0.08em", color,
                    }}>
                      {label}
                    </div>
                    <div>
                      <div style={{ fontSize: 32, fontWeight: 700, color }}>
                        {weeks}
                        <span style={{ fontSize: 14, fontWeight: 400, color: "#64748b", marginLeft: 4 }}>weeks</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>to rewrite threshold</div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginBottom: 4 }}>
                        <span>rewrite now</span><span>52w runway</span>
                      </div>
                      <MiniBar value={pct} max={100} color={color} />
                    </div>
                    <div style={{ fontSize: 11, color: "#475569" }}>
                      temp {e.temperature.toFixed(3)} · measured {fmtAgo(e.ts)}
                    </div>
                  </div>
                );
              })() : (
                <div style={{ color: "#475569" }}>run entropy:measure to see projection</div>
              )}
            </Card>
          </div>

          {/* GitHub Genome */}
          <GenomePanel />

          {/* Activity Stream */}
          <Card title="Activity Stream — Reflex Arcs (live)">
            <div
              ref={activityRef}
              style={{
                maxHeight: 280, overflowY: "auto",
                display: "flex", flexDirection: "column", gap: 4,
              }}
            >
              {activity.length === 0 ? (
                <div style={{ color: "#334155", fontSize: 12, padding: "8px 0" }}>
                  Waiting for events… (reflex arcs will appear here in real time)
                </div>
              ) : activity.map((ev, i) => (
                <div key={i} style={{
                  display: "flex", gap: 12, padding: "5px 8px",
                  background: "#0f172a", borderRadius: 4,
                  borderLeft: `3px solid ${
                    ev.type === "vuln_detected" ? "#ef4444"
                    : ev.type === "vuln_healed" ? "#22c55e"
                    : ev.type === "incident_open" ? "#f97316"
                    : ev.type === "incident_resolved" ? "#22c55e"
                    : ev.type === "antibody_minted" ? "#818cf8"
                    : ev.type === "entropy_measured" ? "#38bdf8"
                    : "#334155"
                  }`,
                }}>
                  <div style={{ fontSize: 10, color: "#475569", whiteSpace: "nowrap", paddingTop: 2 }}>
                    {new Date(ev.ts).toLocaleTimeString()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#cbd5e1" }}>{ev.message}</div>
                    {ev.detail && (
                      <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", marginTop: 2 }}>
                        {ev.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div style={{ textAlign: "center", fontSize: 11, color: "#334155", paddingBottom: 8 }}>
            HELIX autonomous living layer · auto-refreshes every 30s · activity stream live
            {snapshot.ts && ` · snapshot at ${new Date(snapshot.ts).toLocaleTimeString()}`}
          </div>
        </div>
      )}
    </div>
  );
}
