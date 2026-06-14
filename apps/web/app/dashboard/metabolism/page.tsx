"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { motion, AnimatePresence } from "motion/react";
import { Flame, ChevronDown, ChevronUp, GitPullRequest, TrendingUp, FlaskConical } from "lucide-react";
import { HandWrittenTitle } from "@/components/ui/hand-writing-text";
import { cn } from "@/lib/utils";

function fmtAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function tempColor(t: number): string {
  if (t >= 0.7) return "#ef4444";
  if (t >= 0.45) return "#f97316";
  if (t >= 0.3) return "#eab308";
  return "#22c55e";
}

interface GitHubConnection { owner: string; repo: string; }
interface EntropyDims { duplication: number; patternVariance: number; coupling: number; vulnDensity: number; comprehension: number; }
interface MetabolismEnzyme { enzymeType: "consolidator" | "normaliser" | "annealer"; targetZone: string; rationale: string; diff: string; newContent: string; }
interface MetabolismRun {
  runId: string; githubOwner: string; githubRepo: string; shadowBranch: string;
  measuredAt: string; temperature: number; dims: EntropyDims;
  projectedRewriteWeeks: number; enzymes: MetabolismEnzyme[];
  status: "pending_approval" | "approved" | "rejected" | "pr_created";
  prUrl?: string; prNumber?: number;
}

const STATUS_CONFIG = {
  pending_approval: { color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.25)", label: "PENDING APPROVAL" },
  approved:         { color: "#22c55e", bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.25)",  label: "APPROVED" },
  rejected:         { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.25)",  label: "REJECTED" },
  pr_created:       { color: "#22c55e", bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.25)",  label: "PR CREATED" },
};

const ENZYME_CONFIG = {
  consolidator: { color: "#38bdf8", bg: "rgba(56,189,248,0.1)",  border: "rgba(56,189,248,0.2)"  },
  normaliser:   { color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.2)" },
  annealer:     { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.2)"  },
};

const DIM_LABELS: Record<keyof EntropyDims, string> = {
  duplication: "Duplication", patternVariance: "Pattern Variance",
  coupling: "Coupling", vulnDensity: "Vuln Density", comprehension: "Comprehension",
};

function StyledSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border text-[13px] text-white/80 pl-4 pr-10 py-2.5 cursor-pointer focus:outline-none focus:border-white/20 transition-colors duration-200"
        style={{ background: "#0c0c10", borderColor: "rgba(255,255,255,0.08)" }}>
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-white/30 pointer-events-none" />
    </div>
  );
}

export default function MetabolismPage() {
  const [connections, setConnections] = useState<GitHubConnection[]>([]);
  const [selectedConn, setSelectedConn] = useState<string | null>(null);
  const [runs, setRuns] = useState<MetabolismRun[]>([]);
  const [scanning, setScanning] = useState(false);
  const [acting, setActing] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const didAnimate = useRef(false);

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/github/connections");
      const json = await res.json() as { connections?: GitHubConnection[] };
      if (json.connections) setConnections(json.connections);
    } catch { /* ignore */ }
  }, []);

  const loadRuns = useCallback(async (o: string, r: string) => {
    try {
      const res = await fetch(`/api/metabolism-patches?githubOwner=${encodeURIComponent(o)}&githubRepo=${encodeURIComponent(r)}`);
      const json = await res.json() as { runs?: MetabolismRun[] };
      if (json.runs) setRuns(json.runs);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadConnections(); }, [loadConnections]);
  useEffect(() => {
    if (!selectedConn) return;
    const [o, r] = selectedConn.split("/") as [string, string];
    void loadRuns(o, r);
  }, [selectedConn, loadRuns]);

  useEffect(() => {
    if (didAnimate.current) return;
    didAnimate.current = true;
    const ctx = gsap.context(() => {
      gsap.from(".meta-card", { opacity: 0, y: 20, scale: 0.95, duration: 0.45, stagger: 0.08, ease: "back.out(1.3)", delay: 0.15 });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // Animate dim bars when latest run loads
  useEffect(() => {
    if (!runs.length) return;
    const ctx = gsap.context(() => {
      gsap.from(".dim-bar-fill", { scaleX: 0, duration: 0.7, stagger: 0.08, ease: "power2.out", transformOrigin: "left center", delay: 0.1 });
      gsap.from(".run-card", { opacity: 0, y: 16, duration: 0.4, stagger: 0.08, ease: "power2.out" });
    }, rootRef);
    return () => ctx.revert();
  }, [runs.length]);

  async function runScan() {
    if (!selectedConn) { setError("Select a repo first."); return; }
    const [o, r] = selectedConn.split("/") as [string, string];
    setScanning(true); setError(null); setScanStatus("Measuring entropy across repository source files…");
    try {
      const res = await fetch("/api/metabolism-scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubOwner: o, githubRepo: r }),
      });
      const json = await res.json() as { run?: MetabolismRun; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.run) setRuns((prev) => [json.run!, ...prev.filter((x) => x.runId !== json.run!.runId)]);
      setScanStatus(null);
    } catch (e) { setError(e instanceof Error ? e.message : "scan failed"); setScanStatus(null); }
    finally { setScanning(false); }
  }

  async function approve(runId: string) {
    setActing((s) => new Set(s).add(runId)); setError(null);
    try {
      const res = await fetch("/api/metabolism-approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId }) });
      const json = await res.json() as { run?: MetabolismRun; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.run) setRuns((prev) => prev.map((x) => x.runId === runId ? json.run! : x));
    } catch (e) { setError(e instanceof Error ? e.message : "approve failed"); }
    finally { setActing((s) => { const n = new Set(s); n.delete(runId); return n; }); }
  }

  async function reject(runId: string) {
    setActing((s) => new Set(s).add(runId));
    try {
      const res = await fetch("/api/metabolism-reject", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId }) });
      const json = await res.json() as { error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      setRuns((prev) => prev.map((x) => x.runId === runId ? { ...x, status: "rejected" as const } : x));
    } catch (e) { setError(e instanceof Error ? e.message : "reject failed"); }
    finally { setActing((s) => { const n = new Set(s); n.delete(runId); return n; }); }
  }

  const latestRun = runs[0];
  const tempPct = latestRun ? Math.min(100, Math.round(latestRun.temperature * 100)) : 0;

  return (
    <div ref={rootRef} className="max-w-5xl mx-auto px-6 pb-16 pt-2">
      <HandWrittenTitle
        title="Metabolism"
        subtitle="Measures codebase entropy across 5 dimensions. Enzyme actions reduce technical debt automatically via GitHub PRs."
        color="#2dd4bf"
      />

      {/* Hero gauges — visible only when we have data */}
      {latestRun && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Temperature card */}
          <div className="meta-card rounded-2xl border p-6" style={{ background: "rgba(14,14,18,0.8)", borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30 mb-4">Entropy Temperature</div>
            <div className="flex items-end gap-4 mb-5">
              <div className="text-6xl font-black tabular-nums leading-none" style={{ color: tempColor(latestRun.temperature) }}>
                {tempPct}°
              </div>
              <div className="mb-1 text-[12px] text-white/35">
                Rewrite cliff in{" "}
                <span className="font-bold" style={{ color: latestRun.projectedRewriteWeeks < 10 ? "#ef4444" : "#94a3b8" }}>
                  {latestRun.projectedRewriteWeeks}w
                </span>
              </div>
            </div>
            {/* Gradient track */}
            <div className="relative h-2 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(to right, #22c55e 0%, #eab308 48%, #f97316 72%, #ef4444 100%)" }} />
              <div className="absolute inset-0 rounded-full" style={{ background: "rgba(0,0,0,0.0)" }} />
              {/* Marker */}
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)] border-2 border-black transition-all duration-500"
                style={{ left: `calc(${tempPct}% - 6px)` }} />
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-emerald-400/70">Healthy</span>
              <span className="text-amber-400/70">Warming</span>
              <span className="text-red-400/70">Critical</span>
            </div>
          </div>

          {/* Entropy dimensions */}
          <div className="meta-card rounded-2xl border p-6" style={{ background: "rgba(14,14,18,0.8)", borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30 mb-4">Entropy Dimensions</div>
            <div className="flex flex-col gap-3">
              {(Object.keys(DIM_LABELS) as Array<keyof EntropyDims>).map((dim) => {
                const val = latestRun.dims[dim] ?? 0;
                const pct = Math.round(val * 100);
                const c = pct >= 60 ? "#ef4444" : pct >= 40 ? "#f97316" : pct >= 25 ? "#eab308" : "#22c55e";
                return (
                  <div key={dim}>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-white/45">{DIM_LABELS[dim]}</span>
                      <span className="font-bold tabular-nums" style={{ color: c }}>{pct}%</span>
                    </div>
                    <div className="h-[4px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="dim-bar-fill h-full rounded-full" style={{ width: `${pct}%`, background: c }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Scan controls */}
      <div className="meta-card rounded-2xl border p-5 mb-6" style={{ background: "rgba(14,14,18,0.8)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30 mb-4">Scan Controls</div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <div className="text-[11px] text-white/40 mb-2">GitHub Repository</div>
            {connections.length === 0 ? (
              <div className="text-[12px] text-white/30 py-2">
                Connect a repo in{" "}
                <Link href="/dashboard/genome" className="text-teal-400 hover:text-teal-300 transition-colors">Genome</Link>
                {" "}first.
              </div>
            ) : (
              <StyledSelect value={selectedConn ?? ""} onChange={(v) => { setSelectedConn(v || null); setRuns([]); }}>
                <option value="">— select repo —</option>
                {connections.map((c) => { const k = `${c.owner}/${c.repo}`; return <option key={k} value={k}>{k}</option>; })}
              </StyledSelect>
            )}
          </div>
          <button onClick={() => { void runScan(); }} disabled={scanning || !selectedConn}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#0f766e", color: "#fff", boxShadow: "0 0 20px rgba(15,118,110,0.3)" }}>
            <Flame className="size-4" />
            {scanning ? "Measuring…" : "Measure & Propose Enzyme"}
          </button>
        </div>
        <AnimatePresence>
          {scanStatus && (
            <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: "auto", marginTop: 12 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border text-[13px]"
              style={{ background: "rgba(15,118,110,0.08)", borderColor: "rgba(45,212,191,0.2)", color: "#5eead4" }}>
              <span className="relative flex size-2 flex-shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75 animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-teal-400" />
              </span>
              {scanStatus}
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: "auto", marginTop: 12 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="px-4 py-3 rounded-xl border text-[13px]"
              style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", color: "#fca5a5" }}>
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Run history */}
      {runs.length > 0 && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-4">
            {runs.length} run{runs.length !== 1 ? "s" : ""}
          </div>
          <div className="flex flex-col gap-3">
            {runs.map((run) => {
              const sc = STATUS_CONFIG[run.status];
              const isExpanded = expanded.has(run.runId);
              const tc = tempColor(run.temperature);
              return (
                <div key={run.runId} className="run-card rounded-2xl border overflow-hidden"
                  style={{ background: "rgba(14,14,18,0.8)", borderColor: "rgba(255,255,255,0.06)", borderLeft: `3px solid ${sc.color}` }}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[11px] font-mono text-white/40">{run.runId}</span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded"
                            style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>
                            {sc.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-white/30 mb-3 font-mono">
                          {fmtAgo(run.measuredAt)} · shadow: <span className="text-white/40">{run.shadowBranch}</span>
                        </div>
                        <div className="flex items-center gap-4 mb-3">
                          <div className="text-4xl font-black tabular-nums" style={{ color: tc }}>{Math.round(run.temperature * 100)}°</div>
                          <div className="text-[12px] text-white/35">
                            Rewrite in <span className="font-bold" style={{ color: run.projectedRewriteWeeks < 10 ? "#ef4444" : "#94a3b8" }}>{run.projectedRewriteWeeks}w</span>
                          </div>
                        </div>
                        {run.enzymes.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {run.enzymes.map((ez, i) => {
                              const ec = ENZYME_CONFIG[ez.enzymeType];
                              return (
                                <span key={i} className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                                  style={{ color: ec.color, background: ec.bg, border: `1px solid ${ec.border}` }}>
                                  {ez.enzymeType}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {run.status === "pending_approval" && run.enzymes.length > 0 && (
                          <>
                            <button disabled={acting.has(run.runId)} onClick={() => { void approve(run.runId); }}
                              className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50"
                              style={{ background: "rgba(34,197,94,0.1)", color: "#86efac", border: "1px solid rgba(34,197,94,0.25)" }}>
                              {acting.has(run.runId) ? "…" : "Approve & PR"}
                            </button>
                            <button disabled={acting.has(run.runId)} onClick={() => { void reject(run.runId); }}
                              className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50"
                              style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.25)" }}>
                              Reject
                            </button>
                          </>
                        )}
                        {run.status === "pr_created" && run.prUrl && (
                          <a href={run.prUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200"
                            style={{ background: "rgba(34,197,94,0.1)", color: "#86efac", border: "1px solid rgba(34,197,94,0.25)", textDecoration: "none" }}>
                            <GitPullRequest className="size-3.5" />
                            View PR #{run.prNumber}
                          </a>
                        )}
                        {run.enzymes.length > 0 && (
                          <button onClick={() => setExpanded((p) => { const n = new Set(p); n.has(run.runId) ? n.delete(run.runId) : n.add(run.runId); return n; })}
                            className="p-1.5 rounded-lg transition-all duration-200 cursor-pointer"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                            {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Enzyme detail */}
                  <AnimatePresence>
                    {isExpanded && run.enzymes.length > 0 && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                        <div className="px-5 pb-5 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/25 mt-4 mb-3">Enzyme Actions</div>
                          <div className="flex flex-col gap-3">
                            {run.enzymes.map((ez, i) => {
                              const ec = ENZYME_CONFIG[ez.enzymeType];
                              return (
                                <div key={i} className="rounded-xl p-4 border-l-2"
                                  style={{ background: "rgba(0,0,0,0.3)", borderColor: ec.color }}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{ color: ec.color, background: ec.bg }}>
                                      {ez.enzymeType}
                                    </span>
                                    <span className="text-[11px] font-mono text-white/35">{ez.targetZone}</span>
                                  </div>
                                  <div className="text-[12.5px] text-white/60 leading-relaxed mb-2">{ez.rationale}</div>
                                  {ez.diff && (
                                    <details>
                                      <summary className="text-[11px] text-white/30 cursor-pointer hover:text-white/50 transition-colors">View diff</summary>
                                      <pre className="mt-2 text-[10px] font-mono rounded-lg p-3 overflow-x-auto text-white/50 max-h-40 overflow-y-auto"
                                        style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                        {ez.diff}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedConn && runs.length === 0 && !scanning && (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border"
          style={{ background: "rgba(14,14,18,0.6)", borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center mb-4">
            <TrendingUp className="size-5 text-white/20" />
          </div>
          <div className="text-[13px] text-white/30 mb-1">No runs yet.</div>
          <div className="text-[11px] text-white/15">Click &ldquo;Measure & Propose Enzyme&rdquo; to analyse entropy.</div>
        </div>
      )}
    </div>
  );
}
