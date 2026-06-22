"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { APIPlayground, ScanConfig, APITestResponse } from "@/components/ui/api-playground";
import { Feature } from "@/components/ui/feature-with-image-comparison";
import { Feature as ImmuneFeature } from "@/components/ui/feature";
import { Bug, Shield, Syringe, Biohazard, Dna, ShieldAlert } from "lucide-react";

// Neo-Brutalism palette — same light chrome as the Logs page: flat white
// canvas, thick black borders, hard unblurred black offset shadows, flat
// saturated accents, zero gradients/glow.
const NEO = { yellow: "#ffe600", blue: "#2f5ef5", pink: "#ff3ea5", green: "#3ddc84", orange: "#ff7a1a", ink: "#0a0a0a" };

// ── Background decoration — flat icon badges drawn from this page's own domain:
// vulnerabilities (Bug), defenses (Shield), antibodies (Syringe), threats (Biohazard,
// ShieldAlert), and the genome/intent layer (Dna). Zero gradient, ink outline only.

function BgBadge({ Icon, color, size, style }: { Icon: React.ElementType; color: string; size: number; style?: React.CSSProperties }) {
  return (
    <div aria-hidden style={{ position: "absolute", width: size, height: size, border: `3px solid ${NEO.ink}`, background: color, display: "flex", alignItems: "center", justifyContent: "center", ...style }}>
      <Icon size={size * 0.55} style={{ color: NEO.ink }} strokeWidth={2.25} />
    </div>
  );
}

function BgOutlineIcon({ Icon, size, style }: { Icon: React.ElementType; size: number; style?: React.CSSProperties }) {
  return (
    <div aria-hidden style={{ position: "absolute", ...style }}>
      <Icon size={size} style={{ color: NEO.ink }} strokeWidth={1.5} />
    </div>
  );
}

// ── Shared utils ────────────────────────────────────────────────────────────────

function fmtAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

const VULN_COLOR: Record<string, string> = {
  SQLi: NEO.orange,
  XSS: NEO.pink,
  authBypass: NEO.blue,
  secretLeak: NEO.pink,
  missingRLS: NEO.yellow,
};

// ── Types ────────────────────────────────────────────────────────────────────────

interface GitHubConnection { owner: string; repo: string; defaultBranch: string; connectedAt: string; }
interface ImmuneFinding { vulnClass: "SQLi" | "XSS" | "authBypass" | "secretLeak" | "missingRLS"; endpoint: string; evidence: string; affectedFile: string; diff: string; newContent: string; }
interface ImmuneScanRun { scanId: string; githubOwner: string; githubRepo: string; shadowBranch: string; scannedAt: string; findings: ImmuneFinding[]; status: "pending_approval" | "approved" | "rejected" | "pr_created"; prUrl?: string; prNumber?: number; }

const statusColor = (s: string) => {
  if (s === "pending_approval") return NEO.yellow;
  if (s === "approved" || s === "pr_created") return NEO.green;
  if (s === "rejected") return NEO.pink;
  return `${NEO.ink}88`;
};

// ── Button styles (module-level — allocated once, not on every render) ─────────
const btnS: React.CSSProperties = { background: "#fff", border: `2px solid ${NEO.ink}40`, color: `${NEO.ink}cc`, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const btnOk: React.CSSProperties = { background: NEO.green, border: `2px solid ${NEO.ink}`, color: NEO.ink, padding: "5px 11px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: `3px 3px 0px ${NEO.ink}` };
const btnDng: React.CSSProperties = { background: NEO.pink, border: `2px solid ${NEO.ink}`, color: NEO.ink, padding: "5px 11px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: `3px 3px 0px ${NEO.ink}` };

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { connections?: GitHubConnection[] };
      if (json.connections) setConnections(json.connections);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load connections"); }
  }, []);

  const loadScans = useCallback(async (owner: string, repo: string) => {
    try {
      const res = await fetch(`/api/reflex/immune-patches?githubOwner=${encodeURIComponent(owner)}&githubRepo=${encodeURIComponent(repo)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { scans?: ImmuneScanRun[] };
      if (json.scans) setScans(json.scans);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load scans"); }
  }, []);

  useEffect(() => { void loadConnections(); }, [loadConnections]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(t);
  }, [error]);
  useEffect(() => {
    if (!selectedConn) return;
    const [o, r] = selectedConn.split("/") as [string, string];
    void loadScans(o, r);
  }, [selectedConn, loadScans]);

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

  const pending = scans.filter((s) => s.status === "pending_approval").length;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "104px 24px 60px", position: "relative" }}>
      {/* Ambient page background — warm beige canvas, a faint grid, and scattered flat geometric primitives */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden", background: "#f1e6cf" }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(${NEO.ink}0d 1px, transparent 1px), linear-gradient(90deg, ${NEO.ink}0d 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        <BgBadge Icon={Bug} color={NEO.yellow} size={64} style={{ top: "6%", left: "4%", transform: "rotate(-12deg)", opacity: 0.5 }} />
        <BgOutlineIcon Icon={Biohazard} size={90} style={{ top: "14%", right: "6%", opacity: 0.22 }} />
        <BgBadge Icon={Syringe} color={NEO.pink} size={44} style={{ top: "48%", left: "2%", transform: "rotate(8deg)", opacity: 0.4 }} />
        <BgBadge Icon={Shield} color={NEO.blue} size={40} style={{ top: "62%", right: "10%", transform: "rotate(14deg)", opacity: 0.35 }} />
        <BgOutlineIcon Icon={Dna} size={54} style={{ bottom: "18%", left: "8%", opacity: 0.25 }} />
        <BgBadge Icon={Shield} color={NEO.green} size={56} style={{ bottom: "8%", right: "5%", transform: "rotate(-6deg)", opacity: 0.45 }} />
        <BgBadge Icon={ShieldAlert} color={NEO.orange} size={32} style={{ top: "32%", left: "16%", transform: "rotate(10deg)", opacity: 0.3 }} />
      </div>

      {/* Header — raw chunky type, no gradients, no italics */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
        style={{ marginBottom: 48, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative", paddingTop: 32, paddingBottom: 8 }}
      >
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          {/* Eyebrow pill */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
            className="neo-card inline-flex items-center gap-2 px-4 py-1.5"
            style={{ background: NEO.green }}
          >
            <span style={{ width: 8, height: 8, background: NEO.ink, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: NEO.ink, textTransform: "uppercase" }}>
              Adversarial Self-Healing Security
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
            style={{
              fontSize: "clamp(2.4rem, 6vw, 4.4rem)",
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              margin: 0,
              color: NEO.ink,
              textTransform: "uppercase",
            }}
          >
            Immune System
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
            style={{
              fontSize: 14,
              color: `${NEO.ink}99`,
              lineHeight: 1.7,
              maxWidth: 520,
              fontWeight: 700,
              margin: 0,
            }}
          >
            Scans for SQLi · XSS · authBypass · secretLeak · missingRLS via static analysis.
            {" "}Findings await approval before any code changes. Approved patches create a GitHub
            PR and mint permanent antibodies.
          </motion.p>
        </div>
      </motion.div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Open",        value: scans.filter((s) => s.status === "pending_approval").length, color: NEO.pink, id: "IMM-01" },
          { label: "Pending PR",  value: pending,                                                      color: NEO.yellow, id: "IMM-02" },
          { label: "Healed",      value: scans.filter((s) => s.status === "pr_created" || s.status === "approved").length, color: NEO.green, id: "IMM-03" },
          { label: "Total Scans", value: scans.length,                                                 color: NEO.blue, id: "IMM-04" },
        ].map(({ label, value, color, id }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            className="neo-card neo-lift"
            style={{ position: "relative", padding: "18px 16px 16px", overflow: "hidden" }}
          >
            {/* Unit ID — top-right corner */}
            <div style={{ position: "absolute", top: 10, right: 12, fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 700, color: `${NEO.ink}55`, letterSpacing: "0.08em" }}>
              {id}
            </div>

            {/* Label with color swatch */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ width: 10, height: 10, background: color, border: `2px solid ${NEO.ink}`, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: `${NEO.ink}99`, textTransform: "uppercase" }}>
                {label}
              </span>
            </div>

            {/* Value */}
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 36, fontWeight: 900, color, lineHeight: 1 }}>
              {String(value).padStart(2, "0")}
            </div>
          </motion.div>
        ))}
      </div>

      {/* API Playground */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="neo-card neo-lift"
        style={{ borderRadius: 12, padding: "24px", marginBottom: 20 }}
      >
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: NEO.green }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: NEO.green }} />
              </span>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: NEO.ink, margin: 0 }}>Immune Scanner UI</h2>
            </div>
            <p style={{ fontSize: 14, color: `${NEO.ink}88`, margin: 0 }}>Configure and execute advanced security audits against your repositories</p>
          </div>
          {scanStatus && (
            <div style={{ padding: "8px 14px", background: "#fef2f2", border: "1px solid #dc2626", borderRadius: 6, color: "#b91c1c", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
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
            connections={connections.map((c) => `${c.owner}/${c.repo}`)}
            scanning={scanning}
          />
        </div>
        {error && <div style={{ marginTop: 14, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#b91c1c", fontSize: 13 }}>{error}</div>}
      </motion.div>

      {/* Scan results */}
      {scans.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: `${NEO.ink}88`, fontWeight: 800, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Scan runs — {pending} pending approval
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {scans.map((scan, scanIndex) => (
              <motion.div
                key={scan.scanId}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: Math.min(scanIndex, 6) * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="neo-card neo-lift"
                style={{ borderLeftWidth: 6, borderLeftColor: statusColor(scan.status) }}
              >
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", fontWeight: 700, color: `${NEO.ink}88`, marginBottom: 4 }}>{scan.scanId}</div>
                      <div style={{ fontSize: 11, color: `${NEO.ink}66`, fontWeight: 600 }}>
                        {fmtAgo(scan.scannedAt)} · shadow: <span style={{ fontFamily: "ui-monospace, monospace", color: `${NEO.ink}99` }}>{scan.shadowBranch}</span>
                      </div>
                      {scan.findings.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                          {scan.findings.map((f, i) => (
                            <span key={i} style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", background: VULN_COLOR[f.vulnClass] ?? `${NEO.ink}55`, color: NEO.ink, border: `2px solid ${NEO.ink}` }}>
                              {f.vulnClass}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: NEO.ink, padding: "2px 8px", background: statusColor(scan.status), border: `2px solid ${NEO.ink}`, display: "inline-flex", alignItems: "center", gap: 5 }}>
                        {scan.status === "pending_approval" && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: NEO.ink, opacity: 0.5 }} />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: NEO.ink }} />
                          </span>
                        )}
                        {scan.status.replace(/_/g, " ").toUpperCase()}
                      </span>
                      {scan.status === "pending_approval" && scan.findings.length > 0 && (
                        <>
                          <button className="neo-press" style={btnOk} disabled={acting.has(scan.scanId)} onClick={() => { void approve(scan.scanId); }}>
                            {acting.has(scan.scanId) ? "…" : "Approve & PR"}
                          </button>
                          <button className="neo-press" style={btnDng} disabled={acting.has(scan.scanId)} onClick={() => { void reject(scan.scanId); }}>Reject</button>
                        </>
                      )}
                      {scan.status === "pr_created" && scan.prUrl && (
                        <a href={scan.prUrl} target="_blank" rel="noopener noreferrer" className="neo-press" style={{ ...btnOk, textDecoration: "none", fontSize: 12 }}>
                          View PR #{scan.prNumber}
                        </a>
                      )}
                      {scan.findings.length > 0 && (
                        <button className="neo-press" style={btnS} onClick={() => setExpanded((p) => { const n = new Set(p); void (n.has(scan.scanId) ? n.delete(scan.scanId) : n.add(scan.scanId)); return n; })}>
                          {expanded.has(scan.scanId) ? "Hide" : "Details"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {expanded.has(scan.scanId) && scan.findings.length > 0 && (
                  <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {scan.findings.map((f, i) => (
                      <div key={i} style={{ background: NEO.ink, padding: "12px 14px", borderLeft: `3px solid ${VULN_COLOR[f.vulnClass] ?? "#888"}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: VULN_COLOR[f.vulnClass] ?? "#f0ead8" }}>{f.vulnClass}</span>
                          <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#999" }}>{f.affectedFile}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#ccc", marginBottom: 6, fontWeight: 600 }}>{f.evidence}</div>
                        {f.diff && (
                          <details>
                            <summary style={{ fontSize: 11, color: "#999", cursor: "pointer", fontWeight: 700 }}>View patch diff</summary>
                            <pre style={{ marginTop: 6, fontSize: 10, background: "#000", padding: "8px 10px", overflowX: "auto", color: "#ddd", maxHeight: 200, overflowY: "auto" }}>{f.diff}</pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Code Patching Comparison (On Scroll) */}
      <div className="mt-12">
        <Feature />
      </div>

      {selectedConn && scans.length === 0 && !scanning && (
        <div style={{ color: `${NEO.ink}66`, fontSize: 13, fontWeight: 700, textAlign: "center", padding: "40px 0" }}>
          No scans yet for {selectedConn}. Click &ldquo;Run Security Scan&rdquo; to start.
        </div>
      )}
      {!selectedConn && connections.length === 0 && (
        <div style={{ color: `${NEO.ink}66`, fontSize: 13, fontWeight: 700, textAlign: "center", padding: "40px 0" }}>
          Connect a GitHub repository via the <Link href="/dashboard/genome" style={{ color: NEO.green, fontWeight: 800 }}>Genome</Link> panel first.
        </div>
      )}

      {/* How the Immune System works */}
      <ImmuneFeature />
    </div>
  );
}
