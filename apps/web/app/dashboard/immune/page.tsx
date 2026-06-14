"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { APIPlayground, ScanConfig, APITestResponse } from "@/components/ui/api-playground";
import { Feature } from "@/components/ui/feature-with-image-comparison";
import BorderGlow from "@/components/ui/BorderGlow";
import { HandWrittenTitle } from "@/components/ui/hand-writing-text";

// ── Shared utils ────────────────────────────────────────────────────────────────

function fmtAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

const VULN_COLOR: Record<string, string> = {
  SQLi: "#f97316",
  XSS: "#ef4444",
  authBypass: "#8b5cf6",
  secretLeak: "#ec4899",
  missingRLS: "#eab308",
};

// ── Types ────────────────────────────────────────────────────────────────────────

interface GitHubConnection { owner: string; repo: string; defaultBranch: string; connectedAt: string; }
interface ImmuneFinding { vulnClass: "SQLi" | "XSS" | "authBypass" | "secretLeak" | "missingRLS"; endpoint: string; evidence: string; affectedFile: string; diff: string; newContent: string; }
interface ImmuneScanRun { scanId: string; githubOwner: string; githubRepo: string; shadowBranch: string; scannedAt: string; findings: ImmuneFinding[]; status: "pending_approval" | "approved" | "rejected" | "pr_created"; prUrl?: string; prNumber?: number; }

const statusColor = (s: string) => {
  if (s === "pending_approval") return "#f97316";
  if (s === "approved" || s === "pr_created") return "#22c55e";
  if (s === "rejected") return "#ef4444";
  return "#94a3b8";
};

// ── Immune System Page ─────────────────────────────────────────────────────────

export default function ImmunePage() {
  const [connections, setConnections] = useState<GitHubConnection[]>([]);
  const [selectedConn, setSelectedConn] = useState<string | null>(null);
  const [scans, setScans] = useState<ImmuneScanRun[]>([]);
  const [scanning, setScanning] = useState(false);
  const [acting, setActing] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [apiConfig, setApiConfig] = useState<ScanConfig>({
    repoId: "",
    method: "SAST",
    rulesets: [],
    ignorePaths: [],
    branches: [],
    custom: [],
  });

  const handleTest = async (config: ScanConfig): Promise<APITestResponse> => {
    if (!config.repoId) {
      throw new Error("Select a connected repo first.");
    }
    
    // Set the selected connection for the page state
    setSelectedConn(config.repoId);
    
    const [o, r] = config.repoId.split("/") as [string, string];
    setScanning(true);
    setError(null);
    setScanStatus(`Running ${config.method} security analysis on ${o}/${r}…`);
    
    try {
      const res = await fetch("/api/reflex/immune-scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubOwner: o, githubRepo: r }),
      });
      const json = await res.json() as { scan?: ImmuneScanRun; error?: string; message?: string };
      
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      }
      
      if (json.scan) {
        setScans((prev) => [json.scan!, ...prev]);
        return { data: { success: true, message: `Scan ${json.scan.scanId} completed successfully.`, findings: json.scan.findings } };
      }
      
      return { data: { success: true, message: "Scan initialized but no details returned." } };
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : "Scan failed";
      setError(errMessage);
      throw error;
    } finally {
      setScanning(false);
      setScanStatus(null);
    }
  };

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/github/connections");
      const json = await res.json() as { connections?: GitHubConnection[] };
      if (json.connections) setConnections(json.connections);
    } catch { /* ignore */ }
  }, []);

  const loadScans = useCallback(async (owner: string, repo: string) => {
    try {
      const res = await fetch(`/api/reflex/immune-patches?githubOwner=${encodeURIComponent(owner)}&githubRepo=${encodeURIComponent(repo)}`);
      const json = await res.json() as { scans?: ImmuneScanRun[] };
      if (json.scans) setScans(json.scans);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadConnections(); }, [loadConnections]);
  useEffect(() => {
    if (!selectedConn) return;
    const [o, r] = selectedConn.split("/") as [string, string];
    void loadScans(o, r);
  }, [selectedConn, loadScans]);

  async function runScan() {
    if (!selectedConn) { setError("Select a connected repo first."); return; }
    const [o, r] = selectedConn.split("/") as [string, string];
    setScanning(true); setError(null);
    setScanStatus("Running static security analysis…");
    try {
      const res = await fetch("/api/reflex/immune-scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubOwner: o, githubRepo: r }),
      });
      const json = await res.json() as { scan?: ImmuneScanRun; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.scan) setScans((prev) => [json.scan!, ...prev.filter((s) => s.scanId !== json.scan!.scanId)]);
      setScanStatus(null);
    } catch (e) { setError(e instanceof Error ? e.message : "scan failed"); setScanStatus(null); }
    finally { setScanning(false); }
  }

  async function approve(scanId: string) {
    setActing((s) => new Set(s).add(scanId)); setError(null);
    try {
      const res = await fetch("/api/reflex/immune-approve", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scanId }),
      });
      const json = await res.json() as { scan?: ImmuneScanRun; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.scan) setScans((prev) => prev.map((s) => s.scanId === scanId ? json.scan! : s));
    } catch (e) { setError(e instanceof Error ? e.message : "approve failed"); }
    finally { setActing((s) => { const n = new Set(s); n.delete(scanId); return n; }); }
  }

  async function reject(scanId: string) {
    setActing((s) => new Set(s).add(scanId));
    try {
      const res = await fetch("/api/reflex/immune-reject", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scanId }),
      });
      const json = await res.json() as { error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      setScans((prev) => prev.map((s) => s.scanId === scanId ? { ...s, status: "rejected" as const } : s));
    } catch (e) { setError(e instanceof Error ? e.message : "reject failed"); }
    finally { setActing((s) => { const n = new Set(s); n.delete(scanId); return n; }); }
  }

  const open = scans.flatMap((s) => s.findings).length;
  const pending = scans.filter((s) => s.status === "pending_approval").length;

  const sel: React.CSSProperties = { background: "#020614", border: "1px solid #1e293b", borderRadius: 6, color: "#e2e8f0", padding: "7px 10px", fontSize: 13, outline: "none", width: "100%", cursor: "pointer" };
  const btnP: React.CSSProperties = { background: "#be123c", border: "none", borderRadius: 6, color: "#fff", padding: "8px 18px", fontSize: 13, cursor: "pointer", fontWeight: 700 };
  const btnS: React.CSSProperties = { background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#94a3b8", padding: "6px 12px", fontSize: 12, cursor: "pointer" };
  const btnOk: React.CSSProperties = { background: "#052e16", border: "1px solid #14532d", borderRadius: 6, color: "#86efac", padding: "5px 11px", fontSize: 12, cursor: "pointer" };
  const btnDng: React.CSSProperties = { background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 6, color: "#fca5a5", padding: "5px 11px", fontSize: 12, cursor: "pointer" };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px 60px" }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
        <Link href="/dashboard" style={{ color: "#475569", textDecoration: "none" }}>Dashboard</Link>
        <span>›</span>
        <span style={{ color: "#22c55e" }}>Immune System</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 40, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <HandWrittenTitle 
          title="Immune System" 
          subtitle="Monitor and manage automated vulnerability patches." 
        />
        
        <div style={{ marginTop: "-20px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 8, background: "rgba(16, 185, 129, 0.1)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.2)", letterSpacing: "0.08em" }}>
            ADVERSARIAL SELF-HEALING SECURITY
          </span>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 16, lineHeight: 1.6, maxWidth: 600 }}>
            Scans for SQLi · XSS · authBypass · secretLeak · missingRLS via static analysis. Findings wait for approval before any code changes. Approved patches create a GitHub PR and mint permanent antibodies.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {[
          { label: "Open", value: scans.filter((s) => s.status === "pending_approval").length, color: "#ef4444" },
          { label: "Pending PR", value: pending, color: "#f97316" },
          { label: "Healed", value: scans.filter((s) => s.status === "pr_created" || s.status === "approved").length, color: "#22c55e" },
          { label: "Total Scans", value: scans.length, color: "#94a3b8" },
        ].map(({ label, value, color }) => (
          <BorderGlow 
            key={label}
            backgroundColor="#18181b" 
            borderRadius={10} 
            edgeSensitivity={30} 
            glowRadius={20}
            glowColor="0 0 60"
            colors={['#6b7280', '#9ca3af', '#4b5563']}
          >
            <div style={{ padding: "14px 18px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
            </div>
          </BorderGlow>
        ))}
      </div>

      {/* API Playground */}
      <div style={{ background: "#09090b", borderRadius: 12, padding: "24px", marginBottom: 20 }}>
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", margin: "0 0 8px 0" }}>Immune Scanner UI</h2>
            <p style={{ fontSize: 14, color: "#a1a1aa", margin: 0 }}>Configure and execute advanced security audits against your repositories</p>
          </div>
          {scanStatus && (
            <div style={{ padding: "8px 14px", background: "#1a0a0a", border: "1px solid #dc2626", borderRadius: 6, color: "#fca5a5", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626", boxShadow: "0 0 6px #dc2626", flexShrink: 0, display: "inline-block" }} />
              {scanStatus}
            </div>
          )}
        </div>
        <div className="h-[500px]">
          <APIPlayground
            config={apiConfig}
            onTest={handleTest}
            onConfigChange={(newConfig) => {
              setApiConfig(newConfig);
              if (newConfig.repoId !== selectedConn) {
                setSelectedConn(newConfig.repoId);
                setScans([]);
              }
            }}
            connections={connections.map((c: any) => `${c.owner}/${c.repo}`)}
            scanning={scanning}
          />
        </div>
        {error && <div style={{ marginTop: 14, padding: "10px 14px", background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 6, color: "#fca5a5", fontSize: 13 }}>{error}</div>}
      </div>

      {/* Scan results */}
      {scans.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 10 }}>
            Scan runs — {pending} pending approval
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {scans.map((scan) => (
              <BorderGlow 
                key={scan.scanId} 
                backgroundColor="#0a0f1e" 
                borderRadius={12} 
                edgeSensitivity={30}
                glowRadius={30}
                animated={true}
              >
                <div style={{ borderLeft: `3px solid ${statusColor(scan.status)}`, borderRadius: "12px 0 0 12px" }}>
                  <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8", marginBottom: 4 }}>{scan.scanId}</div>
                      <div style={{ fontSize: 11, color: "#475569" }}>
                        {fmtAgo(scan.scannedAt)} · shadow: <span style={{ fontFamily: "monospace", color: "#64748b" }}>{scan.shadowBranch}</span>
                      </div>
                      {scan.findings.length > 0 && (
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                          {scan.findings.map((f, i) => (
                            <span key={i} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: `${VULN_COLOR[f.vulnClass] ?? "#64748b"}18`, color: VULN_COLOR[f.vulnClass] ?? "#94a3b8", border: `1px solid ${VULN_COLOR[f.vulnClass] ?? "#64748b"}30` }}>
                              {f.vulnClass}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: statusColor(scan.status), padding: "2px 8px", borderRadius: 4, background: `${statusColor(scan.status)}15` }}>
                        {scan.status.replace(/_/g, " ").toUpperCase()}
                      </span>
                      {scan.status === "pending_approval" && scan.findings.length > 0 && (
                        <>
                          <button style={btnOk} disabled={acting.has(scan.scanId)} onClick={() => { void approve(scan.scanId); }}>
                            {acting.has(scan.scanId) ? "…" : "Approve & PR"}
                          </button>
                          <button style={btnDng} disabled={acting.has(scan.scanId)} onClick={() => { void reject(scan.scanId); }}>Reject</button>
                        </>
                      )}
                      {scan.status === "pr_created" && scan.prUrl && (
                        <a href={scan.prUrl} target="_blank" rel="noopener noreferrer" style={{ ...btnOk, textDecoration: "none", fontSize: 12 }}>
                          View PR #{scan.prNumber}
                        </a>
                      )}
                      {scan.findings.length > 0 && (
                        <button style={btnS} onClick={() => setExpanded((p) => { const n = new Set(p); n.has(scan.scanId) ? n.delete(scan.scanId) : n.add(scan.scanId); return n; })}>
                          {expanded.has(scan.scanId) ? "Hide" : "Details"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {expanded.has(scan.scanId) && scan.findings.length > 0 && (
                  <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {scan.findings.map((f, i) => (
                      <div key={i} style={{ background: "#020614", borderRadius: 8, padding: "12px 14px", borderLeft: `3px solid ${VULN_COLOR[f.vulnClass] ?? "#64748b"}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: VULN_COLOR[f.vulnClass] ?? "#94a3b8" }}>{f.vulnClass}</span>
                          <span style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>{f.affectedFile}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>{f.evidence}</div>
                        {f.diff && (
                          <details>
                            <summary style={{ fontSize: 11, color: "#475569", cursor: "pointer" }}>View patch diff</summary>
                            <pre style={{ marginTop: 6, fontSize: 10, background: "#000", borderRadius: 4, padding: "8px 10px", overflowX: "auto", color: "#94a3b8", maxHeight: 200, overflowY: "auto" }}>{f.diff}</pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </BorderGlow>
            ))}
          </div>
        </div>
      )}

      {/* Code Patching Comparison (On Scroll) */}
      <div className="mt-12">
        <Feature />
      </div>

      {selectedConn && scans.length === 0 && !scanning && (
        <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "40px 0" }}>
          🛡️ No scans yet for {selectedConn}. Click &ldquo;Run Security Scan&rdquo; to start.
        </div>
      )}
      {!selectedConn && connections.length === 0 && (
        <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "40px 0" }}>
          Connect a GitHub repository via the <Link href="/dashboard/genome" style={{ color: "#22c55e" }}>Genome</Link> panel first.
        </div>
      )}
    </div>
  );
}
