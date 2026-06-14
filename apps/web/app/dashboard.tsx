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

interface MetabolismSnapshot {
  runs: number;
  lastTemp: number | null;
  projectedWeeks: number | null;
}

interface ShadowSnapshot {
  total: number;
  promoted: number;
  rejected: number;
}

interface ShadowProofItem {
  proofId: string;
  changeRef: string;
  verdict: "promote" | "reject";
  verifiedAt: string;
  replayedCases: number;
  intendedFixPassed: boolean;
}

interface MetabolismEnzyme {
  enzymeType: "consolidator" | "normaliser" | "annealer";
  targetZone: string;
  rationale: string;
  diff: string;
  newContent: string;
}

interface MetabolismRun {
  runId: string;
  githubOwner: string;
  githubRepo: string;
  shadowBranch: string;
  measuredAt: string;
  temperature: number;
  dims: EntropyDims;
  projectedRewriteWeeks: number;
  enzymes: MetabolismEnzyme[];
  status: "pending_approval" | "approved" | "rejected" | "pr_created";
  prUrl?: string;
  prNumber?: number;
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
  metabolism: MetabolismSnapshot | null;
  shadow: ShadowSnapshot | null;
  recentShadowProofs: ShadowProofItem[];
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

interface IncidentPatchFile {
  path: string;
  diff: string;
  newContent: string;
}

interface IncidentPatchCausalStep {
  order: number;
  description: string;
  evidenceRef: string;
}

interface IncidentPatch {
  patchId: string;
  incidentId: string;
  githubOwner: string;
  githubRepo: string;
  railwayProjectId: string;
  railwayDeploymentId: string;
  deploymentStatus: string;
  shadowBranch: string;
  detectedAt: string;
  failureSummary: string;
  causalChain: IncidentPatchCausalStep[];
  files: IncidentPatchFile[];
  status: "pending_approval" | "approved" | "rejected" | "pr_created";
  prUrl?: string;
  prNumber?: number;
}

interface RailwayProject {
  id: string;
  name: string;
}

interface ImmuneFinding {
  vulnClass: "SQLi" | "XSS" | "authBypass" | "secretLeak" | "missingRLS";
  endpoint: string;
  evidence: string;
  affectedFile: string;
  diff: string;
  newContent: string;
}

interface ImmuneScanRun {
  scanId: string;
  githubOwner: string;
  githubRepo: string;
  shadowBranch: string;
  scannedAt: string;
  findings: ImmuneFinding[];
  status: "pending_approval" | "approved" | "rejected" | "pr_created";
  prUrl?: string;
  prNumber?: number;
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

// ── Immune System Panel ────────────────────────────────────────────────────────

const VULN_COLOR: Record<string, string> = {
  SQLi: "#f97316",
  XSS: "#ef4444",
  authBypass: "#8b5cf6",
  secretLeak: "#ec4899",
  missingRLS: "#eab308",
};

function ImmunePanel() {
  const [connections, setConnections] = useState<GitHubConnection[]>([]);
  const [selectedConn, setSelectedConn] = useState<string | null>(null);
  const [scans, setScans] = useState<ImmuneScanRun[]>([]);
  const [scanning, setScanning] = useState(false);
  const [acting, setActing] = useState<Set<string>>(new Set());
  const [panelError, setPanelError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/github/connections");
      const json = (await res.json()) as { connections?: GitHubConnection[] };
      if (json.connections) setConnections(json.connections);
    } catch { /* ignore */ }
  }, []);

  const loadScans = useCallback(async (owner: string, repo: string) => {
    try {
      const res = await fetch(
        `/api/reflex/immune-patches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
      );
      const json = (await res.json()) as { scans?: ImmuneScanRun[] };
      if (json.scans) setScans(json.scans);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (!selectedConn) return;
    const [owner, repo] = selectedConn.split("/") as [string, string];
    void loadScans(owner, repo);
  }, [selectedConn, loadScans]);

  async function runScan() {
    if (!selectedConn) {
      setPanelError("Select a connected GitHub repository first.");
      return;
    }
    const [owner, repo] = selectedConn.split("/") as [string, string];
    setScanning(true);
    setPanelError(null);
    setScanStatus("Running static security analysis across repository source files…");
    try {
      const res = await fetch("/api/reflex/immune-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubOwner: owner, githubRepo: repo }),
      });
      const json = (await res.json()) as { scan?: ImmuneScanRun; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.scan) {
        setScans((prev) => [json.scan!, ...prev.filter((s) => s.scanId !== json.scan!.scanId)]);
      }
      setScanStatus(null);
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "scan failed");
      setScanStatus(null);
    } finally {
      setScanning(false);
    }
  }

  async function approve(scanId: string) {
    setActing((s) => new Set(s).add(scanId));
    setPanelError(null);
    try {
      const res = await fetch("/api/reflex/immune-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId }),
      });
      const json = (await res.json()) as { scan?: ImmuneScanRun; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.scan) {
        setScans((prev) => prev.map((s) => s.scanId === scanId ? json.scan! : s));
      }
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "approve failed");
    } finally {
      setActing((s) => { const n = new Set(s); n.delete(scanId); return n; });
    }
  }

  async function reject(scanId: string) {
    setActing((s) => new Set(s).add(scanId));
    try {
      const res = await fetch("/api/reflex/immune-reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId }),
      });
      const json = (await res.json()) as { scanId?: string; status?: string; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      setScans((prev) => prev.map((s) => s.scanId === scanId ? { ...s, status: "rejected" as const } : s));
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "reject failed");
    } finally {
      setActing((s) => { const n = new Set(s); n.delete(scanId); return n; });
    }
  }

  function toggleFindings(scanId: string) {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(scanId)) next.delete(scanId); else next.add(scanId);
      return next;
    });
  }

  const inputStyle: React.CSSProperties = {
    background: "#0f172a", border: "1px solid #334155", borderRadius: 6,
    color: "#e2e8f0", padding: "6px 10px", fontSize: 13, outline: "none",
    width: "100%", boxSizing: "border-box",
  };
  const btnPrimary: React.CSSProperties = {
    background: "#dc2626", border: "none", borderRadius: 6, color: "#e2e8f0",
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
    <Card title="Immune System — Adversarial Self-Healing Security">
      {/* Repo selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>GitHub Repository to scan</div>
          {connections.length === 0 ? (
            <div style={{ fontSize: 12, color: "#475569" }}>
              Connect a repo in the Genome panel first, then return here to scan it.
            </div>
          ) : (
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={selectedConn ?? ""}
              onChange={(e) => {
                setSelectedConn(e.target.value || null);
                setScans([]);
                setPanelError(null);
              }}
            >
              <option value="">— select repo —</option>
              {connections.map((c) => {
                const key = `${c.owner}/${c.repo}`;
                return <option key={key} value={key}>{key}</option>;
              })}
            </select>
          )}
        </div>
        <button
          style={btnPrimary}
          onClick={() => { void runScan(); }}
          disabled={scanning || !selectedConn}
        >
          {scanning ? "Scanning…" : "Run Security Scan"}
        </button>
      </div>

      {/* Scan explanation */}
      <div style={{ fontSize: 11, color: "#475569", marginBottom: 12, lineHeight: 1.6 }}>
        Scans SQLi · XSS · authBypass · secretLeak · missingRLS via static analysis (Gemini wide-context + Sarvam patch synthesis).
        Findings wait for your approval before any code is changed.
        Approved patches create a GitHub PR and mint antibodies for Immune Memory.
      </div>

      {scanStatus && (
        <div style={{
          background: "#1a0a0a", border: "1px solid #dc2626", borderRadius: 6,
          padding: "10px 14px", color: "#fca5a5", fontSize: 13, marginBottom: 12,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#dc2626", boxShadow: "0 0 6px #dc2626", flexShrink: 0 }} />
          {scanStatus}
        </div>
      )}

      {panelError && (
        <div style={{ background: "#450a0a", borderRadius: 6, padding: "8px 12px", color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>
          {panelError}
        </div>
      )}

      {/* Scan runs */}
      {scans.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
            Scan runs — {scans.filter((s) => s.status === "pending_approval").length} pending approval
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {scans.map((scan) => (
              <div key={scan.scanId} style={{
                background: "#1e293b", borderRadius: 8, padding: "12px 16px",
                borderLeft: `3px solid ${statusColor(scan.status)}`,
              }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8" }}>{scan.scanId}</div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                      scanned {fmtAgo(scan.scannedAt)} · shadow: <span style={{ fontFamily: "monospace", color: "#64748b" }}>{scan.shadowBranch}</span>
                    </div>
                    {/* Finding class chips */}
                    {scan.findings.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {scan.findings.map((f, i) => (
                          <span key={i} style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                            padding: "2px 7px", borderRadius: 4,
                            background: `${VULN_COLOR[f.vulnClass] ?? "#64748b"}20`,
                            color: VULN_COLOR[f.vulnClass] ?? "#94a3b8",
                            border: `1px solid ${VULN_COLOR[f.vulnClass] ?? "#64748b"}40`,
                          }}>
                            {f.vulnClass}
                          </span>
                        ))}
                        {scan.findings.length === 0 && (
                          <span style={{ fontSize: 11, color: "#22c55e" }}>No vulnerabilities found</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                      color: statusColor(scan.status),
                      padding: "2px 8px", borderRadius: 4,
                      background: `${statusColor(scan.status)}18`,
                    }}>
                      {scan.status.replace(/_/g, " ").toUpperCase()}
                    </span>
                    {scan.status === "pending_approval" && scan.findings.length > 0 && (
                      <>
                        <button
                          style={btnSuccess}
                          disabled={acting.has(scan.scanId)}
                          onClick={() => { void approve(scan.scanId); }}
                        >
                          {acting.has(scan.scanId) ? "…" : "Approve & Create PR"}
                        </button>
                        <button
                          style={btnDanger}
                          disabled={acting.has(scan.scanId)}
                          onClick={() => { void reject(scan.scanId); }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {scan.status === "pr_created" && scan.prUrl && (
                      <a
                        href={scan.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...btnSuccess, textDecoration: "none", fontSize: 12 }}
                      >
                        View PR #{scan.prNumber}
                      </a>
                    )}
                    {scan.findings.length > 0 && (
                      <button style={btnSecondary} onClick={() => toggleFindings(scan.scanId)}>
                        {expandedFindings.has(scan.scanId) ? "Hide" : "Details"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded findings */}
                {expandedFindings.has(scan.scanId) && scan.findings.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {scan.findings.map((f, i) => (
                      <div key={i} style={{
                        background: "#0f172a", borderRadius: 6, padding: "10px 14px",
                        borderLeft: `3px solid ${VULN_COLOR[f.vulnClass] ?? "#64748b"}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: VULN_COLOR[f.vulnClass] ?? "#94a3b8",
                          }}>
                            {f.vulnClass}
                          </span>
                          <span style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>
                            {f.affectedFile}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>{f.evidence}</div>
                        {f.diff && (
                          <details>
                            <summary style={{ fontSize: 11, color: "#475569", cursor: "pointer", userSelect: "none" }}>
                              View diff
                            </summary>
                            <pre style={{
                              marginTop: 6, fontSize: 10, background: "#020617",
                              borderRadius: 4, padding: "8px 10px", overflowX: "auto",
                              color: "#94a3b8", maxHeight: 200, overflowY: "auto",
                            }}>
                              {f.diff}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedConn && scans.length === 0 && !scanning && (
        <div style={{ color: "#475569", fontSize: 13 }}>
          No scans yet for {selectedConn}. Click &ldquo;Run Security Scan&rdquo; to analyze the repository for vulnerabilities.
        </div>
      )}

      {!selectedConn && connections.length === 0 && (
        <div style={{ color: "#475569", fontSize: 13 }}>
          Connect a GitHub repository via the Genome panel first, then come here to run a security scan against it.
        </div>
      )}
    </Card>
  );
}

// ── Nervous System Railway Panel ──────────────────────────────────────────────

function NervousPanel() {
  const [projects, setProjects] = useState<RailwayProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [connections, setConnections] = useState<GitHubConnection[]>([]);
  const [selectedConn, setSelectedConn] = useState<string | null>(null);
  const [patches, setPatches] = useState<IncidentPatch[]>([]);
  const [checking, setChecking] = useState(false);
  const [acting, setActing] = useState<Set<string>>(new Set());
  const [panelError, setPanelError] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/reflex/railway-projects");
      const json = (await res.json()) as { projects?: RailwayProject[]; error?: string; message?: string };
      if (json.projects) { setProjects(json.projects); setProjectsLoaded(true); }
    } catch { /* ignore */ }
  }, []);

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/github/connections");
      const json = (await res.json()) as { connections?: GitHubConnection[] };
      if (json.connections) setConnections(json.connections);
    } catch { /* ignore */ }
  }, []);

  const loadPatches = useCallback(async (owner: string, repo: string) => {
    try {
      const res = await fetch(`/api/reflex/incident-patches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`);
      const json = (await res.json()) as { patches?: IncidentPatch[] };
      if (json.patches) setPatches(json.patches);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void loadProjects();
    void loadConnections();
  }, [loadProjects, loadConnections]);

  useEffect(() => {
    if (!selectedConn) return;
    const [owner, repo] = selectedConn.split("/") as [string, string];
    void loadPatches(owner, repo);
  }, [selectedConn, loadPatches]);

  async function checkFailures() {
    if (!selectedProject || !selectedConn) {
      setPanelError("Select a Railway project and a GitHub repo first.");
      return;
    }
    const [owner, repo] = selectedConn.split("/") as [string, string];
    setChecking(true);
    setPanelError(null);
    setAutoStatus("Scanning Railway for failed deployments…");
    try {
      const res = await fetch("/api/reflex/railway-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProject, githubOwner: owner, githubRepo: repo }),
      });
      const json = (await res.json()) as { patch?: IncidentPatch; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.patch) {
        setPatches((prev) => [json.patch!, ...prev.filter((p) => p.patchId !== json.patch!.patchId)]);
        setAutoStatus(null);
      }
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "check failed");
      setAutoStatus(null);
    } finally {
      setChecking(false);
    }
  }

  async function approve(patchId: string) {
    setActing((s) => new Set(s).add(patchId));
    try {
      const res = await fetch("/api/reflex/incident-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patchId }),
      });
      const json = (await res.json()) as { patch?: IncidentPatch; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.patch) {
        setPatches((prev) => prev.map((p) => p.patchId === patchId ? json.patch! : p));
      }
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "approve failed");
    } finally {
      setActing((s) => { const n = new Set(s); n.delete(patchId); return n; });
    }
  }

  async function reject(patchId: string) {
    setActing((s) => new Set(s).add(patchId));
    try {
      const res = await fetch("/api/reflex/incident-reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patchId }),
      });
      const json = (await res.json()) as { patchId?: string; status?: string; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      setPatches((prev) => prev.map((p) => p.patchId === patchId ? { ...p, status: "rejected" as const } : p));
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "reject failed");
    } finally {
      setActing((s) => { const n = new Set(s); n.delete(patchId); return n; });
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "#0f172a", border: "1px solid #334155", borderRadius: 6,
    color: "#e2e8f0", padding: "6px 10px", fontSize: 13, outline: "none",
    width: "100%", boxSizing: "border-box",
  };
  const btnPrimary: React.CSSProperties = {
    background: "#7c3aed", border: "none", borderRadius: 6, color: "#e2e8f0",
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
    <Card title="Nervous System — Railway Resurrection Reflex">
      {/* Project + repo selectors */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Railway Project</div>
          {!projectsLoaded ? (
            <button style={btnSecondary} onClick={() => { void loadProjects(); }}>Load projects</button>
          ) : (
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={selectedProject ?? ""}
              onChange={(e) => setSelectedProject(e.target.value || null)}
            >
              <option value="">— select project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>GitHub Repository</div>
          {connections.length === 0 ? (
            <div style={{ fontSize: 12, color: "#475569" }}>
              Connect a repo in Genome panel first
            </div>
          ) : (
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={selectedConn ?? ""}
              onChange={(e) => setSelectedConn(e.target.value || null)}
            >
              <option value="">— select repo —</option>
              {connections.map((c) => {
                const key = `${c.owner}/${c.repo}`;
                return <option key={key} value={key}>{key}</option>;
              })}
            </select>
          )}
        </div>
        <button
          style={btnPrimary}
          onClick={() => { void checkFailures(); }}
          disabled={checking || !selectedProject || !selectedConn}
        >
          {checking ? "Scanning…" : "Check for Failures"}
        </button>
      </div>

      {autoStatus && (
        <div style={{
          background: "#1a0a3a", border: "1px solid #7c3aed", borderRadius: 6,
          padding: "10px 14px", color: "#c4b5fd", fontSize: 13, marginBottom: 12,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#7c3aed", boxShadow: "0 0 6px #7c3aed", flexShrink: 0 }} />
          {autoStatus}
        </div>
      )}

      {panelError && (
        <div style={{ background: "#450a0a", borderRadius: 6, padding: "8px 12px", color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>
          {panelError}
        </div>
      )}

      {/* Incident Patches */}
      {patches.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
            Incident patches — {patches.filter((p) => p.status === "pending_approval").length} pending approval
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {patches.map((p) => (
              <div key={p.patchId} style={{
                background: "#1e293b", borderRadius: 8, padding: "12px 16px",
                borderLeft: `3px solid ${statusColor(p.status)}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8" }}>
                      {p.patchId}
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                      detected {fmtAgo(p.detectedAt)} · deployment{" "}
                      <span style={{ fontFamily: "monospace", color: "#64748b" }}>{p.railwayDeploymentId.slice(0, 8)}</span>
                      {" "}({p.deploymentStatus}) · shadow:{" "}
                      <span style={{ fontFamily: "monospace", color: "#64748b" }}>{p.shadowBranch}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 6 }}>
                      {p.failureSummary}
                    </div>
                    {p.causalChain.length > 0 && (
                      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                        {p.causalChain.slice(0, 3).map((s) => (
                          <div key={s.order} style={{ fontSize: 11, color: "#64748b" }}>
                            <span style={{ color: "#7c3aed" }}>{s.order}.</span> {s.description}
                          </div>
                        ))}
                      </div>
                    )}
                    {p.files.length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>
                        {p.files.length} file(s): {p.files.map((f) => f.path).join(", ")}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                      color: statusColor(p.status),
                      padding: "2px 8px", borderRadius: 4,
                      background: `${statusColor(p.status)}18`,
                    }}>
                      {p.status.replace(/_/g, " ").toUpperCase()}
                    </span>
                    {p.status === "pending_approval" && (
                      <>
                        <button
                          style={btnSuccess}
                          disabled={acting.has(p.patchId)}
                          onClick={() => { void approve(p.patchId); }}
                        >
                          {acting.has(p.patchId) ? "…" : "Approve & Create PR"}
                        </button>
                        <button
                          style={btnDanger}
                          disabled={acting.has(p.patchId)}
                          onClick={() => { void reject(p.patchId); }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {p.status === "pr_created" && p.prUrl && (
                      <a
                        href={p.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...btnSuccess, textDecoration: "none", fontSize: 12 }}
                      >
                        View PR #{p.prNumber}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!selectedProject && !selectedConn && (
        <div style={{ color: "#475569", fontSize: 13 }}>
          Select a Railway project and a connected GitHub repo, then click &ldquo;Check for Failures&rdquo; to detect and patch deployment errors automatically.
        </div>
      )}

      {selectedProject && selectedConn && patches.length === 0 && !checking && (
        <div style={{ color: "#475569", fontSize: 13 }}>
          No incident patches yet. Click &ldquo;Check for Failures&rdquo; to scan for Railway deployment failures.
        </div>
      )}
    </Card>
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
  const [autoStatus, setAutoStatus] = useState<string | null>(null);

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
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("github_connected");
    if (connected) {
      const parts = connected.split("/");
      if (parts.length === 2) {
        const [o, r] = parts as [string, string];
        setOwner(o);
        setRepo(r);
        setSelectedConn(connected);
        window.history.replaceState({}, "", window.location.pathname);
        // Auto-run full genome workflow after successful OAuth connection
        void (async () => {
          await loadDrifts(o, r);
          // Reads current drifts state via functional updater to avoid stale closure;
          // runs workflow only when no prior reports exist for this repo.
          setDrifts((prev) => {
            const hasReports = prev.some(
              (d) => d.githubOwner === o && d.githubRepo === r,
            );
            if (!hasReports) {
              void runAutoWorkflow(o, r);
            }
            return prev;
          });
        })();
        return;
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
    const err = params.get("error");
    if (err) {
      setConnError(decodeURIComponent(err));
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadConnections, loadDrifts]);

  function parseGitHubUrl(raw: string): { owner: string; repo: string } | null {
    const s = raw.trim().replace(/\.git$/, "");
    // Full URL: https://github.com/owner/repo
    const urlMatch = /github\.com\/([^/\s]+)\/([^/\s]+)/.exec(s);
    if (urlMatch) return { owner: urlMatch[1]!, repo: urlMatch[2]! };
    // owner/repo shorthand
    const slashMatch = /^([^/\s]+)\/([^/\s]+)$/.exec(s);
    if (slashMatch) return { owner: slashMatch[1]!, repo: slashMatch[2]! };
    return null;
  }

  function handleRepoInput(raw: string) {
    const parsed = parseGitHubUrl(raw);
    if (parsed) {
      setOwner(parsed.owner);
      setRepo(parsed.repo);
    } else {
      setRepo(raw);
    }
  }

  function connectOAuth() {
    const effectiveOwner = owner.trim();
    const effectiveRepo = repo.trim();
    if (!effectiveOwner || !effectiveRepo) {
      setPanelError("Enter a GitHub URL or owner + repo name before connecting.");
      return;
    }
    setPanelError(null);
    window.location.href = `/api/auth/github?owner=${encodeURIComponent(effectiveOwner)}&repo=${encodeURIComponent(effectiveRepo)}`;
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

  async function runIndex(o = owner, r = repo) {
    if (!o || !r) return;
    setIndexing(true);
    setPanelError(null);
    setIndexResult(null);
    try {
      const docPaths = intentDocs.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await fetch("/api/reflex/genome-index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: o, repo: r, intentDocs: docPaths }),
      });
      const json = (await res.json()) as { indexed?: number; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      setIndexResult(`Indexed ${json.indexed ?? 0} modules into intent strands.`);
      return json.indexed ?? 0;
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "indexing failed");
      throw e;
    } finally {
      setIndexing(false);
    }
  }

  async function runDrift(o = owner, r = repo) {
    if (!o || !r) return;
    setDetecting(true);
    setPanelError(null);
    try {
      const res = await fetch("/api/reflex/genome-drift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: o, repo: r }),
      });
      const json = (await res.json()) as { report?: DriftReport; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.report) {
        setDrifts((prev) => [json.report!, ...prev.filter((d) => d.driftId !== json.report!.driftId)]);
      }
      return json.report;
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "drift detection failed");
      throw e;
    } finally {
      setDetecting(false);
    }
  }

  async function runAutoWorkflow(o: string, r: string) {
    setAutoStatus("Step 1/2 — Indexing repository into intent strands…");
    setPanelError(null);
    try {
      await runIndex(o, r);
    } catch {
      setAutoStatus(null);
      return; // error already shown via setPanelError
    }
    setAutoStatus("Step 2/2 — Detecting drift against intent strands…");
    try {
      await runDrift(o, r);
    } catch {
      // error shown via setPanelError
    }
    setAutoStatus(null);
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
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, alignItems: "end", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
            GitHub Repository <span style={{ color: "#475569" }}>(URL or owner/repo)</span>
          </div>
          <input
            style={inputStyle}
            value={repo && owner ? `${owner}/${repo}` : repo}
            onChange={(e) => handleRepoInput(e.target.value)}
            placeholder="https://github.com/octocat/my-repo  or  octocat/my-repo"
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Intent doc paths <span style={{ color: "#475569" }}>(comma-sep, optional)</span></div>
          <input style={inputStyle} value={intentDocs} onChange={(e) => setIntentDocs(e.target.value)} placeholder="docs/PRD.md,ARCHITECTURE.md" />
        </div>
        <button style={btnPrimary} onClick={connectOAuth}>Connect via GitHub</button>
      </div>
      {owner && repo && (
        <div style={{ fontSize: 11, color: "#475569", marginBottom: 12 }}>
          Parsed: owner = <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>{owner}</span>
          {" "}/ repo = <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>{repo}</span>
        </div>
      )}

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

      {autoStatus && (
        <div style={{
          background: "#0c1a3a", border: "1px solid #1e40af", borderRadius: 6,
          padding: "10px 14px", color: "#93c5fd", fontSize: 13, marginBottom: 12,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 6px #3b82f6", flexShrink: 0 }} />
          {autoStatus}
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
          No drift reports for {selectedConn}. Index the repo then run &ldquo;Detect Drift&rdquo;.
        </div>
      )}

      {!selectedConn && connections.length === 0 && (
        <div style={{ color: "#475569", fontSize: 13 }}>
          Enter owner + repo above and click &ldquo;Connect via GitHub&rdquo; to authenticate HELIX with your repository.
        </div>
      )}
    </Card>
  );
}

// ── Metabolism Panel ──────────────────────────────────────────────────────────

function MetabolismPanel() {
  const [connections, setConnections] = useState<GitHubConnection[]>([]);
  const [selectedConn, setSelectedConn] = useState<string | null>(null);
  const [runs, setRuns] = useState<MetabolismRun[]>([]);
  const [scanning, setScanning] = useState(false);
  const [acting, setActing] = useState<Set<string>>(new Set());
  const [panelError, setPanelError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/github/connections");
      const json = (await res.json()) as { connections?: GitHubConnection[] };
      if (json.connections) setConnections(json.connections);
    } catch { /* ignore */ }
  }, []);

  const loadRuns = useCallback(async (owner: string, repo: string) => {
    try {
      const res = await fetch(
        `/api/metabolism-patches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
      );
      const json = (await res.json()) as { runs?: MetabolismRun[] };
      if (json.runs) setRuns(json.runs);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (!selectedConn) return;
    const [owner, repo] = selectedConn.split("/") as [string, string];
    void loadRuns(owner, repo);
  }, [selectedConn, loadRuns]);

  async function runScan() {
    if (!selectedConn) {
      setPanelError("Select a connected GitHub repository first.");
      return;
    }
    const [owner, repo] = selectedConn.split("/") as [string, string];
    setScanning(true);
    setPanelError(null);
    setScanStatus("Measuring entropy across repository source files…");
    try {
      const res = await fetch("/api/metabolism-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubOwner: owner, githubRepo: repo }),
      });
      const json = (await res.json()) as { run?: MetabolismRun; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.run) {
        setRuns((prev) => [json.run!, ...prev.filter((r) => r.runId !== json.run!.runId)]);
      }
      setScanStatus(null);
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "scan failed");
      setScanStatus(null);
    } finally {
      setScanning(false);
    }
  }

  async function approve(runId: string) {
    setActing((s) => new Set(s).add(runId));
    setPanelError(null);
    try {
      const res = await fetch("/api/metabolism-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      const json = (await res.json()) as { run?: MetabolismRun; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.run) {
        setRuns((prev) => prev.map((r) => r.runId === runId ? json.run! : r));
      }
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "approve failed");
    } finally {
      setActing((s) => { const n = new Set(s); n.delete(runId); return n; });
    }
  }

  async function reject(runId: string) {
    setActing((s) => new Set(s).add(runId));
    try {
      const res = await fetch("/api/metabolism-reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      const json = (await res.json()) as { runId?: string; status?: string; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      setRuns((prev) => prev.map((r) => r.runId === runId ? { ...r, status: "rejected" as const } : r));
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "reject failed");
    } finally {
      setActing((s) => { const n = new Set(s); n.delete(runId); return n; });
    }
  }

  function toggleExpanded(runId: string) {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId); else next.add(runId);
      return next;
    });
  }

  const inputStyle: React.CSSProperties = {
    background: "#0f172a", border: "1px solid #334155", borderRadius: 6,
    color: "#e2e8f0", padding: "6px 10px", fontSize: 13, outline: "none",
    width: "100%", boxSizing: "border-box",
  };
  const btnPrimary: React.CSSProperties = {
    background: "#0f766e", border: "none", borderRadius: 6, color: "#e2e8f0",
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

  const enzymeColor: Record<string, string> = {
    consolidator: "#38bdf8",
    normaliser: "#a78bfa",
    annealer: "#34d399",
  };

  return (
    <Card title="Metabolism — Entropy Digestion">
      {/* Repo selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>GitHub Repository to measure</div>
          {connections.length === 0 ? (
            <div style={{ fontSize: 12, color: "#475569" }}>
              Connect a repo in the Genome panel first, then return here to measure entropy.
            </div>
          ) : (
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={selectedConn ?? ""}
              onChange={(e) => {
                setSelectedConn(e.target.value || null);
                setRuns([]);
                setPanelError(null);
              }}
            >
              <option value="">— select repo —</option>
              {connections.map((c) => {
                const key = `${c.owner}/${c.repo}`;
                return <option key={key} value={key}>{key}</option>;
              })}
            </select>
          )}
        </div>
        <button
          style={btnPrimary}
          onClick={() => { void runScan(); }}
          disabled={scanning || !selectedConn}
        >
          {scanning ? "Measuring…" : "Measure & Propose Enzyme"}
        </button>
      </div>

      <div style={{ fontSize: 11, color: "#475569", marginBottom: 12, lineHeight: 1.6 }}>
        Measures entropy temperature across 5 dimensions (Gemini wide-context). Proposes ONE enzyme action
        (consolidator / normaliser / annealer) via Sarvam. Approved enzymes create a GitHub PR.
      </div>

      {scanStatus && (
        <div style={{
          background: "#0c2a25", border: "1px solid #0f766e", borderRadius: 6,
          padding: "10px 14px", color: "#5eead4", fontSize: 13, marginBottom: 12,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#0f766e", boxShadow: "0 0 6px #0f766e", flexShrink: 0 }} />
          {scanStatus}
        </div>
      )}

      {panelError && (
        <div style={{ background: "#450a0a", borderRadius: 6, padding: "8px 12px", color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>
          {panelError}
        </div>
      )}

      {runs.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
            Metabolism runs — {runs.filter((r) => r.status === "pending_approval").length} pending approval
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {runs.map((run) => (
              <div key={run.runId} style={{
                background: "#1e293b", borderRadius: 8, padding: "12px 16px",
                borderLeft: `3px solid ${statusColor(run.status)}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8" }}>{run.runId}</div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                      measured {fmtAgo(run.measuredAt)} · shadow:{" "}
                      <span style={{ fontFamily: "monospace", color: "#64748b" }}>{run.shadowBranch}</span>
                    </div>
                    {/* Temperature */}
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: tempColor(run.temperature) }}>
                        {run.temperature.toFixed(3)}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        temperature · rewrite in{" "}
                        <span style={{ color: run.projectedRewriteWeeks < 10 ? "#ef4444" : "#94a3b8", fontWeight: 600 }}>
                          {run.projectedRewriteWeeks}w
                        </span>
                      </div>
                    </div>
                    {/* Enzyme chips */}
                    {run.enzymes.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {run.enzymes.map((ez, i) => (
                          <span key={i} style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                            padding: "2px 7px", borderRadius: 4,
                            background: `${enzymeColor[ez.enzymeType] ?? "#64748b"}20`,
                            color: enzymeColor[ez.enzymeType] ?? "#94a3b8",
                            border: `1px solid ${enzymeColor[ez.enzymeType] ?? "#64748b"}40`,
                          }}>
                            {ez.enzymeType}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                      color: statusColor(run.status),
                      padding: "2px 8px", borderRadius: 4,
                      background: `${statusColor(run.status)}18`,
                    }}>
                      {run.status.replace(/_/g, " ").toUpperCase()}
                    </span>
                    {run.status === "pending_approval" && run.enzymes.length > 0 && (
                      <>
                        <button
                          style={btnSuccess}
                          disabled={acting.has(run.runId)}
                          onClick={() => { void approve(run.runId); }}
                        >
                          {acting.has(run.runId) ? "…" : "Approve & Create PR"}
                        </button>
                        <button
                          style={btnDanger}
                          disabled={acting.has(run.runId)}
                          onClick={() => { void reject(run.runId); }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {run.status === "pr_created" && run.prUrl && (
                      <a
                        href={run.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...btnSuccess, textDecoration: "none", fontSize: 12 }}
                      >
                        View PR #{run.prNumber}
                      </a>
                    )}
                    {run.enzymes.length > 0 && (
                      <button style={btnSecondary} onClick={() => toggleExpanded(run.runId)}>
                        {expandedRuns.has(run.runId) ? "Hide" : "Details"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {expandedRuns.has(run.runId) && (
                  <div style={{ marginTop: 12 }}>
                    {/* Dims table */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                      {(Object.entries(run.dims) as Array<[string, number]>).map(([dim, val]) => (
                        <div key={dim}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2, fontSize: 11, color: "#64748b" }}>
                            <span>{dim}</span><span>{val.toFixed(3)}</span>
                          </div>
                          <MiniBar value={val} color={tempColor(val)} />
                        </div>
                      ))}
                    </div>
                    {/* Enzyme actions */}
                    {run.enzymes.map((ez, i) => (
                      <div key={i} style={{
                        background: "#0f172a", borderRadius: 6, padding: "10px 14px",
                        borderLeft: `3px solid ${enzymeColor[ez.enzymeType] ?? "#64748b"}`,
                        marginBottom: 8,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: enzymeColor[ez.enzymeType] ?? "#94a3b8",
                          }}>
                            {ez.enzymeType}
                          </span>
                          <span style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>
                            {ez.targetZone}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>{ez.rationale}</div>
                        {ez.diff && (
                          <details>
                            <summary style={{ fontSize: 11, color: "#475569", cursor: "pointer", userSelect: "none" }}>
                              View diff
                            </summary>
                            <pre style={{
                              marginTop: 6, fontSize: 10, background: "#020617",
                              borderRadius: 4, padding: "8px 10px", overflowX: "auto",
                              color: "#94a3b8", maxHeight: 200, overflowY: "auto",
                            }}>
                              {ez.diff}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedConn && runs.length === 0 && !scanning && (
        <div style={{ color: "#475569", fontSize: 13 }}>
          No metabolism runs yet for {selectedConn}. Click &ldquo;Measure & Propose Enzyme&rdquo; to analyse entropy.
        </div>
      )}

      {!selectedConn && connections.length === 0 && (
        <div style={{ color: "#475569", fontSize: 13 }}>
          Connect a GitHub repository via the Genome panel first, then come here to measure entropy.
        </div>
      )}
    </Card>
  );
}

// ── Shadow Panel ──────────────────────────────────────────────────────────────

function ShadowPanel({ snapshot }: { snapshot: VitalsSnapshot }) {
  const shadow = snapshot.shadow;
  const proofs = snapshot.recentShadowProofs ?? [];

  return (
    <Card title="Shadow — Safety Proofs">
      {shadow ? (
        <div>
          {/* Stats */}
          <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
            {[
              ["total", shadow.total, "#94a3b8"],
              ["promoted", shadow.promoted, "#22c55e"],
              ["rejected", shadow.rejected, "#ef4444"],
            ].map(([label, val, color]) => (
              <div key={String(label)}>
                <div style={{ fontSize: 40, fontWeight: 800, color: String(color) }}>{String(val)}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{String(label)}</div>
              </div>
            ))}
          </div>

          {shadow.total > 0 && (
            <div style={{ marginBottom: 16 }}>
              <MiniBar value={shadow.promoted} max={shadow.total} color="#22c55e" />
              <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                {Math.round((shadow.promoted / shadow.total) * 100)}% promote rate
              </div>
            </div>
          )}

          {/* Recent proofs */}
          {proofs.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Recent shadow proofs</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {proofs.map((p) => (
                  <div key={p.proofId} style={{
                    background: "#1e293b", borderRadius: 6, padding: "8px 12px",
                    borderLeft: `3px solid ${p.verdict === "promote" ? "#22c55e" : "#ef4444"}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8" }}>{p.proofId}</div>
                      <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
                        ref: <span style={{ color: "#64748b" }}>{p.changeRef}</span>{" "}
                        · {p.replayedCases} case{p.replayedCases !== 1 ? "s" : ""}{" "}
                        · {fmtAgo(p.verifiedAt)}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                      color: p.verdict === "promote" ? "#22c55e" : "#ef4444",
                      padding: "2px 8px", borderRadius: 4,
                      background: p.verdict === "promote" ? "#052e1620" : "#450a0a20",
                      border: `1px solid ${p.verdict === "promote" ? "#14532d" : "#7f1d1d"}`,
                      flexShrink: 0, marginLeft: 8,
                    }}>
                      {p.verdict.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {proofs.length === 0 && (
            <div style={{ color: "#475569", fontSize: 13 }}>
              No shadow proofs yet. Approve or reject patches in Genome, Immune, Nervous, or Metabolism to create proofs.
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: "#475569", fontSize: 13 }}>No shadow proof data yet.</div>
      )}
    </Card>
  );
}

// ── Governor Panel ────────────────────────────────────────────────────────────

function GovernorPanel({ snapshot }: { snapshot: VitalsSnapshot }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<GovernorSnapshot | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  const latestGov = result ?? snapshot.governor;

  async function runCheck() {
    setChecking(true);
    setPanelError(null);
    try {
      const res = await fetch("/api/reflex/governor-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ window: "24h" }),
      });
      const json = (await res.json()) as { homeostasis?: GovernorSnapshot; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.homeostasis) setResult(json.homeostasis);
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "governor check failed");
    } finally {
      setChecking(false);
    }
  }

  const btnPrimary: React.CSSProperties = {
    background: "#1e3a5f", border: "none", borderRadius: 6, color: "#e2e8f0",
    padding: "7px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600,
  };

  return (
    <Card title="Homeostasis — The Governor">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6, flex: 1 }}>
          Checks generation vs repair rate balance over the last 24h. Gates new AI generation when entropy exceeds safe thresholds.
        </div>
        <button
          style={btnPrimary}
          onClick={() => { void runCheck(); }}
          disabled={checking}
        >
          {checking ? "Checking…" : "Run Governor Check"}
        </button>
      </div>

      {panelError && (
        <div style={{ background: "#450a0a", borderRadius: 6, padding: "8px 12px", color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>
          {panelError}
        </div>
      )}

      {latestGov ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{
              padding: "10px 24px", borderRadius: 8,
              background: `${actionColor(latestGov.action)}18`,
              border: `2px solid ${actionColor(latestGov.action)}`,
              fontSize: 20, fontWeight: 800, letterSpacing: "0.06em",
              color: actionColor(latestGov.action),
            }}>
              {actionLabel(latestGov.action)}
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>balance</div>
              <div style={{
                fontSize: 32, fontWeight: 700,
                color: latestGov.balance >= 0 ? "#22c55e" : "#ef4444",
              }}>
                {latestGov.balance >= 0 ? "+" : ""}{latestGov.balance}
              </div>
              <div style={{ fontSize: 11, color: "#475569" }}>
                {latestGov.repairRate} healed / {latestGov.generationRate} generated ({latestGov.window})
              </div>
            </div>
          </div>

          {latestGov.hottestZones.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>hottest zones</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {latestGov.hottestZones.map((z) => (
                  <div key={z} style={{
                    fontSize: 12, fontFamily: "monospace",
                    background: "#1e293b", borderRadius: 4,
                    padding: "3px 10px", color: "#f97316",
                  }}>
                    {z}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: "#475569", fontSize: 13 }}>
          No governor data yet. Click &ldquo;Run Governor Check&rdquo; to evaluate homeostasis.
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
                  No intent strands yet. Connect a GitHub repository and index it via the{" "}
                  <span style={{ color: "#38bdf8" }}>GitHub Genome</span> panel above to start tracking genetic integrity.
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
                <div style={{ color: "#475569" }}>
                  Run a <span style={{ color: "#0f766e" }}>Metabolism</span> scan below to measure entropy and see the health projection.
                </div>
              )}
            </Card>
          </div>

          {/* GitHub Genome */}
          <GenomePanel />

          {/* Immune System — Security Scanner */}
          <ImmunePanel />

          {/* Nervous System Railway Reflex */}
          <NervousPanel />

          {/* Metabolism — Entropy Digestion */}
          <MetabolismPanel />

          {/* Shadow — Safety Proofs */}
          <ShadowPanel snapshot={snapshot} />

          {/* Governor — Homeostasis interactive panel */}
          <GovernorPanel snapshot={snapshot} />

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
