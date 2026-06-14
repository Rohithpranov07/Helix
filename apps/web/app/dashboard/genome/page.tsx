"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GenomeConnectUI } from "@/components/ui/bolt-style-chat";
import DisplayCards from "@/components/ui/display-cards";
import { VerticalTabs } from "@/components/ui/vertical-tabs";
import { FolderGit2, Activity, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

function fmtAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

interface GitHubConnection { owner: string; repo: string; defaultBranch: string; connectedAt: string; }
interface DriftMismatch { invariantId: string; description: string; affectedFile: string; diff: string; newContent: string; }
interface DriftReport { driftId: string; strandId: string; githubOwner: string; githubRepo: string; shadowBranch: string; detectedAt: string; mismatches: DriftMismatch[]; status: "pending_approval" | "approved" | "rejected" | "pr_created"; prUrl?: string; prNumber?: number; }

const statusColor = (s: string) => {
  if (s === "pending_approval") return "#f97316";
  if (s === "approved" || s === "pr_created") return "#22c55e";
  if (s === "rejected") return "#ef4444";
  return "#94a3b8";
};

function parseGitHubUrl(raw: string): { owner: string; repo: string } | null {
  const s = raw.trim().replace(/\.git$/, "");
  const urlMatch = /github\.com\/([^/\s]+)\/([^/\s]+)/.exec(s);
  if (urlMatch) return { owner: urlMatch[1]!, repo: urlMatch[2]! };
  const slashMatch = /^([^/\s]+)\/([^/\s]+)$/.exec(s);
  if (slashMatch) return { owner: slashMatch[1]!, repo: slashMatch[2]! };
  return null;
}

export default function GenomePage() {
  const [connections, setConnections] = useState<GitHubConnection[]>([]);
  const [drifts, setDrifts] = useState<DriftReport[]>([]);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [intentDocs, setIntentDocs] = useState("");
  const [intentDocsContent, setIntentDocsContent] = useState<string[]>([]);
  const [selectedConn, setSelectedConn] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [indexResult, setIndexResult] = useState<string | null>(null);
  const [indexedCount, setIndexedCount] = useState<number | undefined>(undefined);
  const [acting, setActing] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const inp: React.CSSProperties = { background: "#020614", border: "1px solid #1e293b", borderRadius: 6, color: "#e2e8f0", padding: "7px 10px", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
  const btnP: React.CSSProperties = { background: "#1e3a8a", border: "none", borderRadius: 6, color: "#fff", padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 700 };
  const btnS: React.CSSProperties = { background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#94a3b8", padding: "6px 12px", fontSize: 12, cursor: "pointer" };
  const btnOk: React.CSSProperties = { background: "#052e16", border: "1px solid #14532d", borderRadius: 6, color: "#86efac", padding: "5px 11px", fontSize: 12, cursor: "pointer" };
  const btnDng: React.CSSProperties = { background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 6, color: "#fca5a5", padding: "5px 11px", fontSize: 12, cursor: "pointer" };

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/github/connections");
      const json = await res.json() as { connections?: GitHubConnection[] };
      if (json.connections) setConnections(json.connections);
    } catch { /* ignore */ }
  }, []);

  const loadDrifts = useCallback(async (o: string, r: string) => {
    try {
      const res = await fetch(`/api/reflex/genome-drifts?githubOwner=${encodeURIComponent(o)}&githubRepo=${encodeURIComponent(r)}`);
      const json = await res.json() as { reports?: DriftReport[] };
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
        setOwner(o); setRepo(r); setSelectedConn(connected);
        window.history.replaceState({}, "", window.location.pathname);
        void loadDrifts(o, r);
        void (async () => {
          await runIndex(o, r);
          await runDrift(o, r);
        })();
      }
    }
    const err = params.get("error");
    if (err) { setConnError(decodeURIComponent(err)); window.history.replaceState({}, "", window.location.pathname); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadConnections, loadDrifts]);

  function handleRepoInput(raw: string) {
    const p = parseGitHubUrl(raw);
    if (p) { setOwner(p.owner); setRepo(p.repo); } else setRepo(raw);
  }

  function connectOAuth(modelId: string = 'deep-scan') {
    const o = owner.trim(), r = repo.trim();
    if (!o || !r) { setError("Enter owner + repo before connecting."); return; }

    const key = `${o}/${r}`;
    if (connections.some((c) => `${c.owner}/${c.repo}` === key)) {
      // Already connected! Skip OAuth and animation. Just select it and run requested mode.
      setSelectedConn(key);
      setOwner(o);
      setRepo(r);
      setDrifts([]);
      void loadDrifts(o, r);
      if (modelId === 'deep-scan') {
        void (async () => {
          await runIndex(o, r);
          await runDrift(o, r);
        })();
      } else {
        void runDrift(o, r);
      }
      return;
    }

    setError(null);
    setIsConnecting(true);
  }

  function proceedWithConnect() {
    const o = owner.trim(), r = repo.trim();
    window.location.href = `/api/auth/github?owner=${encodeURIComponent(o)}&repo=${encodeURIComponent(r)}`;
  }

  async function runIndex(o = owner, r = repo): Promise<number | undefined> {
    if (!o || !r) return;
    setIndexing(true); setError(null); setIndexResult(null);
    try {
      const docs = intentDocs.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await fetch("/api/reflex/genome-index", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: o, repo: r, intentDocs: docs, intentDocsContent }),
      });
      const json = await res.json() as { indexed?: number; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      const n = json.indexed ?? 0;
      setIndexResult(`Indexed ${n} modules.`);
      setIndexedCount(n);
      return n;
    } catch (e) { setError(e instanceof Error ? e.message : "indexing failed"); throw e; }
    finally { setIndexing(false); }
  }

  async function runDrift(o = owner, r = repo) {
    if (!o || !r) return;
    setDetecting(true); setError(null);
    try {
      const res = await fetch("/api/reflex/genome-drift", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: o, repo: r }),
      });
      const json = await res.json() as { report?: DriftReport; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.report) setDrifts((prev) => [json.report!, ...prev.filter((d) => d.driftId !== json.report!.driftId)]);
      return json.report;
    } catch (e) { setError(e instanceof Error ? e.message : "drift detection failed"); throw e; }
    finally { setDetecting(false); }
  }

  async function approve(driftId: string) {
    setActing((s) => new Set(s).add(driftId));
    try {
      const res = await fetch("/api/reflex/genome-approve", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ driftId }),
      });
      const json = await res.json() as { report?: DriftReport; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.report) setDrifts((prev) => prev.map((d) => d.driftId === driftId ? json.report! : d));
    } catch (e) { setError(e instanceof Error ? e.message : "approve failed"); }
    finally { setActing((s) => { const n = new Set(s); n.delete(driftId); return n; }); }
  }

  async function reject(driftId: string) {
    setActing((s) => new Set(s).add(driftId));
    try {
      const res = await fetch("/api/reflex/genome-reject", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ driftId }),
      });
      const json = await res.json() as { error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      setDrifts((prev) => prev.map((d) => d.driftId === driftId ? { ...d, status: "rejected" as const } : d));
    } catch (e) { setError(e instanceof Error ? e.message : "reject failed"); }
    finally { setActing((s) => { const n = new Set(s); n.delete(driftId); return n; }); }
  }

  const totalDrifted = drifts.filter((d) => d.status === "pending_approval").length;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <GenomeConnectUI
        repoValue={repo && owner ? `${owner}/${repo}` : repo}
        onRepoChange={handleRepoInput}
        onConnect={connectOAuth}
        connectedRepos={connections}
        onSelectRepo={(o, r) => {
          setSelectedConn(`${o}/${r}`);
          setOwner(o);
          setRepo(r);
          setDrifts([]);
          void loadDrifts(o, r);
        }}
        {...(selectedConn ? { selectedConnKey: selectedConn } : {})}
        onAction={(action) => {
          if (action === 'index') void runIndex();
          if (action === 'detect') void runDrift();
          if (action === 'refresh') void loadDrifts(owner, repo);
        }}
        actionStates={{ indexing, detecting }}
        isConnected={connections.some((c) => `${c.owner}/${c.repo}` === (repo && owner ? `${owner}/${repo}` : repo))}
        onUploadIntentDoc={(content) => setIntentDocsContent(prev => [...prev, content])}
      >
        <div style={{ padding: "0 20px" }}>
          {connError && (
            <div style={{ background: "#450a0a", borderRadius: 8, padding: "10px 14px", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>
              OAuth error: {connError}
            </div>
          )}
          {error && (
            <div style={{ background: "#450a0a", borderRadius: 8, padding: "10px 14px", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {isConnecting ? (
            /* ── CONNECT FLOW: VerticalTabs only, no drift noise ── */
            <div className="w-full">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-white/20 uppercase tracking-widest font-semibold">Genome pipeline</span>
                <button
                  onClick={() => setIsConnecting(false)}
                  className="text-[11px] text-white/25 hover:text-white/60 transition-colors flex items-center gap-1.5"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="size-3"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>
                  Cancel
                </button>
              </div>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                <VerticalTabs onComplete={proceedWithConnect} {...(indexedCount !== undefined ? { indexed: indexedCount } : {})} />
              </motion.div>
            </div>
          ) : (
            /* ── IDLE / CONNECTED: DisplayCards + drift reports ── */
            <>
              <div className="flex w-full items-center justify-center pt-0 pb-10 mb-12 -ml-12 sm:-ml-24">
                <DisplayCards cards={[
                  {
                    icon: <FolderGit2 className="size-5 text-[#38bdf8]" />,
                    title: <span className="text-[#8a8a8f] font-semibold tracking-wide text-sm uppercase">Connected Repos</span>,
                    description: <span className="text-[#38bdf8]">{connections.length}</span>,
                    className: "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-[#0f0f0f]/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
                  },
                  {
                    icon: <Activity className="size-5 text-[#f97316]" />,
                    title: <span className="text-[#8a8a8f] font-semibold tracking-wide text-sm uppercase">Drift Reports</span>,
                    description: <span className="text-[#f97316]">{drifts.length}</span>,
                    className: "[grid-area:stack] translate-x-12 translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-[#0f0f0f]/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
                  },
                  {
                    icon: <AlertTriangle className="size-5 text-[#eab308]" />,
                    title: <span className="text-[#8a8a8f] font-semibold tracking-wide text-sm uppercase">Pending Approval</span>,
                    description: <span className="text-[#eab308]">{totalDrifted}</span>,
                    className: "[grid-area:stack] translate-x-24 translate-y-20 hover:translate-y-10",
                  }
                ]} />
              </div>

              {/* ── Index result banner ── */}
              {indexResult && (
                <div style={{ background: "#052e16", border: "1px solid #14532d", borderRadius: 8, padding: "10px 14px", color: "#86efac", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <svg viewBox="0 0 16 16" fill="currentColor" width={14} height={14}><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.751.751 0 011.042-1.08L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
                  {indexResult}
                </div>
              )}

              {/* ── Drift Reports ── */}
              {drifts.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: 11, color: "#8a8a8f", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        {drifts.length} drift report{drifts.length !== 1 ? "s" : ""}
                      </span>
                      {totalDrifted > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#f97316", background: "#f9731615", border: "1px solid #f9731625", borderRadius: 4, padding: "2px 8px", letterSpacing: "0.08em" }}>
                          {totalDrifted} PENDING
                        </span>
                      )}
                      {totalDrifted === 0 && drifts.length > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", background: "#22c55e15", border: "1px solid #22c55e25", borderRadius: 4, padding: "2px 8px", letterSpacing: "0.08em" }}>
                          ALL RESOLVED
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {drifts.map((d) => (
                      <div
                        key={d.driftId}
                        style={{
                          background: "rgba(18, 18, 22, 0.7)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          backdropFilter: "blur(16px)",
                          borderRadius: 14,
                          overflow: "hidden",
                          borderLeft: `3px solid ${statusColor(d.status)}`,
                        }}
                      >
                        {/* Card header */}
                        <div style={{ padding: "16px 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8", marginBottom: 5, wordBreak: "break-all" }}>
                              {d.driftId}
                            </div>
                            <div style={{ fontSize: 11, color: "#5a5a5f" }}>
                              detected {fmtAgo(d.detectedAt)} · shadow:{" "}
                              <span style={{ fontFamily: "monospace", color: "#7a7a7f" }}>{d.shadowBranch}</span>
                            </div>
                            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                              {d.mismatches.length} mismatch{d.mismatches.length !== 1 ? "es" : ""}
                              {d.mismatches.length > 0 && (
                                <span style={{ color: "#5a5a5f" }}>
                                  {" "}— {d.mismatches.map((m) => m.invariantId).join(", ")}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                            <span
                              style={{
                                fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                                color: statusColor(d.status),
                                padding: "3px 9px", borderRadius: 5,
                                background: `${statusColor(d.status)}12`,
                                border: `1px solid ${statusColor(d.status)}25`,
                              }}
                            >
                              {d.status.replace(/_/g, " ").toUpperCase()}
                            </span>

                            {d.status === "pending_approval" && (
                              <>
                                <button
                                  style={btnOk}
                                  disabled={acting.has(d.driftId)}
                                  onClick={() => { void approve(d.driftId); }}
                                >
                                  {acting.has(d.driftId) ? "…" : "Approve & PR"}
                                </button>
                                <button
                                  style={btnDng}
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
                                style={{ ...btnOk, textDecoration: "none", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                              >
                                <svg viewBox="0 0 16 16" fill="currentColor" width={12} height={12}>
                                  <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z"/>
                                </svg>
                                View PR #{d.prNumber}
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Mismatches */}
                        {d.mismatches.length > 0 && (
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "12px 20px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                            {d.mismatches.map((m, i) => (
                              <div
                                key={`${m.invariantId}-${i}`}
                                style={{
                                  background: "rgba(0,0,0,0.35)",
                                  borderRadius: 8,
                                  padding: "9px 13px",
                                  fontSize: 11,
                                  color: "#6a6a6f",
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "4px 8px",
                                  alignItems: "baseline",
                                }}
                              >
                                <span style={{ color: "#f97316", fontFamily: "monospace", flexShrink: 0 }}>[{m.invariantId}]</span>
                                <span style={{ color: "#94a3b8" }}>{m.description}</span>
                                <span style={{ color: "#3a3a3f", fontFamily: "monospace" }}>→</span>
                                <span style={{ fontFamily: "monospace", color: "#5a5a5f" }}>{m.affectedFile}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedConn && drifts.length === 0 && !detecting && (
                <div style={{ color: "#5a5a5f", fontSize: 13, textAlign: "center", padding: "48px 0" }}>
                  No drift reports for <span style={{ fontFamily: "monospace", color: "#7a7a7f" }}>{selectedConn}</span>. Index the repo then run Detect Drift.
                </div>
              )}
              {!selectedConn && connections.length === 0 && (
                <div style={{ color: "#5a5a5f", fontSize: 13, textAlign: "center", padding: "48px 0" }}>
                  Connect a GitHub repository above to start monitoring genetic integrity.
                </div>
              )}
            </>
          )}
        </div>
      </GenomeConnectUI>
    </div>
  );
}
