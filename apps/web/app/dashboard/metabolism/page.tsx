"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { motion, AnimatePresence } from "motion/react";
import { Flame, ChevronDown, ChevronUp, GitPullRequest, TrendingUp, Thermometer } from "lucide-react";
import RuixenSection from "@/components/ui/ruixen-feature-section";

// Shared light palette — black ink + flat accents, same language as the
// Logs / Immune / Reflex / API Playground surfaces: white canvas, bold black
// borders, emerald/red/blue/amber accents, zero gradients or pastel tints.
const INK = "#18181b";
const ACCENT = { emerald: "#059669", red: "#dc2626", blue: "#2563eb", amber: "#d97706" };

// ── Background decoration — flat icon badges drawn from this page's own domain:
// entropy/heat (Flame, Thermometer), drift trend (TrendingUp), and resulting
// patches (GitPullRequest). Zero gradient, ink outline only.
function BgBadge({ Icon, color, size, style }: { Icon: React.ElementType; color: string; size: number; style?: React.CSSProperties }) {
  return (
    <div aria-hidden style={{ position: "absolute", width: size, height: size, border: `3px solid ${INK}`, background: color, display: "flex", alignItems: "center", justifyContent: "center", ...style }}>
      <Icon size={size * 0.55} style={{ color: INK }} strokeWidth={2.25} />
    </div>
  );
}

function BgOutlineIcon({ Icon, size, style }: { Icon: React.ElementType; size: number; style?: React.CSSProperties }) {
  return (
    <div aria-hidden style={{ position: "absolute", ...style }}>
      <Icon size={size} style={{ color: INK }} strokeWidth={1.5} />
    </div>
  );
}

function fmtAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function tempColor(t: number): string {
  if (t >= 0.6) return ACCENT.red;
  if (t >= 0.35) return ACCENT.amber;
  return ACCENT.emerald;
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
  pending_approval: { color: ACCENT.amber,   label: "PENDING APPROVAL" },
  approved:         { color: ACCENT.emerald, label: "APPROVED" },
  rejected:         { color: ACCENT.red,     label: "REJECTED" },
  pr_created:       { color: ACCENT.emerald, label: "PR CREATED" },
};

// Each enzyme keeps a distinct shape (a small holdover from the entropy
// organ's original Kandinsky-inspired iconography) mapped onto the shared accents.
const ENZYME_CONFIG = {
  consolidator: { color: ACCENT.blue,   shape: "circle" as const },
  normaliser:   { color: ACCENT.amber,  shape: "triangle" as const },
  annealer:     { color: ACCENT.red,    shape: "square" as const },
};

const DIM_LABELS: Record<keyof EntropyDims, string> = {
  duplication: "Duplication", patternVariance: "Pattern Variance",
  coupling: "Coupling", vulnDensity: "Vuln Density", comprehension: "Comprehension",
};

function EnzymeShape({ shape, color, size = 14 }: { shape: "circle" | "triangle" | "square"; color: string; size?: number }) {
  if (shape === "circle") {
    return <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0 }} />;
  }
  if (shape === "triangle") {
    return (
      <span style={{
        display: "inline-block", width: 0, height: 0, flexShrink: 0,
        borderLeft: `${size / 2}px solid transparent`, borderRight: `${size / 2}px solid transparent`, borderBottom: `${size * 0.87}px solid ${color}`,
      }} />
    );
  }
  return <span style={{ display: "inline-block", width: size, height: size, background: color, flexShrink: 0, borderRadius: 3 }} />;
}

function StyledSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none text-[13px] font-bold pl-4 pr-10 py-2.5 cursor-pointer focus:outline-none transition-colors duration-150 rounded-md"
        style={{ background: "#fff", border: `2px solid ${INK}`, color: INK }}>
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none" style={{ color: INK }} />
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
    <div ref={rootRef} className="max-w-5xl mx-auto px-6 pb-16 relative" style={{ paddingTop: 104, background: "#f1e6cf" }}>
      {/* Ambient page background — warm beige canvas, a faint grid, and scattered flat icon badges */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden", background: "#f1e6cf" }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(${INK}0d 1px, transparent 1px), linear-gradient(90deg, ${INK}0d 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        <BgBadge Icon={Flame} color={ACCENT.red} size={60} style={{ top: "6%", left: "4%", transform: "rotate(-10deg)", opacity: 0.45 }} />
        <BgOutlineIcon Icon={Thermometer} size={90} style={{ top: "16%", right: "6%", opacity: 0.22 }} />
        <BgBadge Icon={TrendingUp} color={ACCENT.amber} size={42} style={{ top: "50%", left: "2%", transform: "rotate(8deg)", opacity: 0.4 }} />
        <BgBadge Icon={GitPullRequest} color={ACCENT.blue} size={38} style={{ top: "62%", right: "10%", transform: "rotate(14deg)", opacity: 0.35 }} />
        <BgOutlineIcon Icon={Flame} size={54} style={{ bottom: "18%", left: "8%", opacity: 0.25 }} />
        <BgBadge Icon={Thermometer} color={ACCENT.emerald} size={54} style={{ bottom: "8%", right: "5%", transform: "rotate(-6deg)", opacity: 0.4 }} />
      </div>

      {/* Header — bold black type, solid accent badge, no gradients or shapes */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
        className="flex flex-col items-center text-center relative pb-2 mb-10"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.12, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full"
          style={{ background: ACCENT.emerald, border: `2px solid ${INK}` }}
        >
          <span style={{ width: 8, height: 8, background: "#fff", borderRadius: "50%", flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "#fff", textTransform: "uppercase" }}>
            Entropy Metabolism
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          style={{ fontSize: "clamp(2.2rem, 5.6vw, 4rem)", lineHeight: 1, letterSpacing: "-0.03em", margin: 0, fontWeight: 900, color: INK, textTransform: "uppercase" }}
        >
          Metabolism
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="mt-5 max-w-md text-[14px] leading-relaxed font-semibold"
          style={{ color: `${INK}99`, textWrap: "balance" as React.CSSProperties["textWrap"] }}
        >
          Measures codebase entropy across 5 dimensions. Enzyme actions reduce technical debt automatically via GitHub PRs.
        </motion.p>
      </motion.div>

      {/* Hero gauges — visible only when we have data */}
      {latestRun && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Temperature card */}
          <div className="meta-card rounded-xl p-6" style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: `6px 6px 0px ${INK}` }}>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] mb-4" style={{ color: INK }}>Entropy Temperature</div>
            <div className="flex items-end gap-4 mb-5">
              <div className="text-6xl font-black tabular-nums leading-none" style={{ color: tempColor(latestRun.temperature) }}>
                {tempPct}°
              </div>
              <div className="mb-1 text-[12px] font-semibold" style={{ color: `${INK}88` }}>
                Rewrite cliff in{" "}
                <span className="font-extrabold" style={{ color: latestRun.projectedRewriteWeeks < 10 ? ACCENT.red : INK }}>
                  {latestRun.projectedRewriteWeeks}w
                </span>
              </div>
            </div>
            {/* Three-zone color track, no gradient */}
            <div className="relative h-3 mb-2 rounded-full overflow-hidden" style={{ border: `2px solid ${INK}`, display: "flex" }}>
              <div style={{ flex: 1, background: ACCENT.emerald }} />
              <div style={{ flex: 1, background: ACCENT.amber, borderLeft: `2px solid ${INK}` }} />
              <div style={{ flex: 1, background: ACCENT.red, borderLeft: `2px solid ${INK}` }} />
              {/* Marker */}
              <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full transition-all duration-500"
                style={{ left: `calc(${tempPct}% - 7px)`, background: "#fff", border: `2.5px solid ${INK}` }} />
            </div>
            <div className="flex justify-between text-[10px] font-extrabold uppercase">
              <span style={{ color: ACCENT.emerald }}>Healthy</span>
              <span style={{ color: ACCENT.amber }}>Warming</span>
              <span style={{ color: ACCENT.red }}>Critical</span>
            </div>
          </div>

          {/* Entropy dimensions */}
          <div className="meta-card rounded-xl p-6" style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: `6px 6px 0px ${INK}` }}>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] mb-4" style={{ color: INK }}>Entropy Dimensions</div>
            <div className="flex flex-col gap-3">
              {(Object.keys(DIM_LABELS) as Array<keyof EntropyDims>).map((dim) => {
                const val = latestRun.dims[dim] ?? 0;
                const pct = Math.round(val * 100);
                const c = pct >= 60 ? ACCENT.red : pct >= 35 ? ACCENT.amber : ACCENT.emerald;
                return (
                  <div key={dim}>
                    <div className="flex justify-between text-[11px] mb-1.5 font-bold">
                      <span style={{ color: `${INK}99` }}>{DIM_LABELS[dim]}</span>
                      <span className="font-extrabold tabular-nums" style={{ color: c }}>{pct}%</span>
                    </div>
                    <div className="h-[6px] rounded-full overflow-hidden" style={{ background: `${INK}14`, border: `1.5px solid ${INK}22` }}>
                      <div className="dim-bar-fill h-full" style={{ width: `${pct}%`, background: c }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Scan controls */}
      <div className="meta-card rounded-xl p-5 mb-6" style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: `6px 6px 0px ${INK}` }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: INK, textTransform: "uppercase", marginBottom: 16 }}>
          Scan Controls
          <span style={{ display: "block", width: 22, height: 4, background: ACCENT.blue, marginTop: 6 }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <div className="text-[11px] font-bold mb-2" style={{ color: `${INK}99` }}>GitHub Repository</div>
            {connections.length === 0 ? (
              <div className="text-[12px] font-semibold py-2" style={{ color: `${INK}99` }}>
                Connect a repo in{" "}
                <Link href="/dashboard/genome" style={{ color: ACCENT.blue, textDecoration: "underline" }}>Genome</Link>
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
            className="memphis-press flex items-center gap-2 px-5 py-2.5 text-[13px] font-extrabold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed uppercase rounded-md"
            style={{ background: INK, color: "#fff", border: `2px solid ${INK}`, boxShadow: `0 0 0 3px ${ACCENT.emerald}26` }}>
            <Flame className="size-4" />
            {scanning ? "Measuring…" : "Measure & Propose Enzyme"}
          </button>
        </div>
        <AnimatePresence>
          {scanStatus && (
            <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: "auto", marginTop: 12 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="flex items-center gap-3 px-4 py-3 text-[13px] font-bold rounded-md"
              style={{ background: "#eff6ff", border: `1.5px solid ${ACCENT.blue}55`, color: "#1e3a8a" }}>
              <span style={{ width: 8, height: 8, background: ACCENT.blue, borderRadius: "50%", flexShrink: 0 }} />
              {scanStatus}
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: "auto", marginTop: 12 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="px-4 py-3 text-[13px] font-bold rounded-md"
              style={{ background: "#fef2f2", border: `1.5px solid ${ACCENT.red}55`, color: "#b91c1c" }}>
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Run history */}
      {runs.length > 0 && (
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-widest mb-4" style={{ color: `${INK}99` }}>
            {runs.length} run{runs.length !== 1 ? "s" : ""}
          </div>
          <div className="flex flex-col gap-4">
            {runs.map((run) => {
              const sc = STATUS_CONFIG[run.status];
              const isExpanded = expanded.has(run.runId);
              const tc = tempColor(run.temperature);
              return (
                <div key={run.runId} className="run-card rounded-xl relative" style={{ background: "#fff", border: `2px solid ${INK}`, borderLeftWidth: 5, borderLeftColor: sc.color, boxShadow: `5px 5px 0px ${INK}`, overflow: "hidden" }}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[11px] font-mono font-bold" style={{ color: `${INK}88` }}>{run.runId}</span>
                          <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase" style={{ background: sc.color, color: "#fff", letterSpacing: "0.06em" }}>
                            {sc.label}
                          </span>
                        </div>
                        <div className="text-[11px] font-bold mb-3" style={{ color: `${INK}66` }}>
                          {fmtAgo(run.measuredAt)} · shadow: <span style={{ color: `${INK}99` }}>{run.shadowBranch}</span>
                        </div>
                        <div className="flex items-center gap-4 mb-3">
                          <div className="text-4xl font-black tabular-nums" style={{ color: tc }}>{Math.round(run.temperature * 100)}°</div>
                          <div className="text-[12px] font-semibold" style={{ color: `${INK}88` }}>
                            Rewrite in <span className="font-extrabold" style={{ color: run.projectedRewriteWeeks < 10 ? ACCENT.red : INK }}>{run.projectedRewriteWeeks}w</span>
                          </div>
                        </div>
                        {run.enzymes.length > 0 && (
                          <div className="flex gap-2.5 flex-wrap">
                            {run.enzymes.map((ez, i) => {
                              const ec = ENZYME_CONFIG[ez.enzymeType];
                              return (
                                <span key={i} className="inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase"
                                  style={{ color: INK, background: "#fff", border: `1.5px solid ${INK}` }}>
                                  <EnzymeShape shape={ec.shape} color={ec.color} size={9} />
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
                              className="memphis-press px-3.5 py-1.5 text-[12px] font-extrabold cursor-pointer disabled:opacity-50 rounded-md"
                              style={{ background: ACCENT.emerald, color: "#fff", border: `2px solid ${INK}` }}>
                              {acting.has(run.runId) ? "…" : "Approve & PR"}
                            </button>
                            <button disabled={acting.has(run.runId)} onClick={() => { void reject(run.runId); }}
                              className="memphis-press px-3.5 py-1.5 text-[12px] font-extrabold cursor-pointer disabled:opacity-50 rounded-md"
                              style={{ background: ACCENT.red, color: "#fff", border: `2px solid ${INK}` }}>
                              Reject
                            </button>
                          </>
                        )}
                        {run.status === "pr_created" && run.prUrl && (
                          <a href={run.prUrl} target="_blank" rel="noopener noreferrer"
                            className="memphis-press flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-extrabold rounded-md"
                            style={{ background: ACCENT.emerald, color: "#fff", border: `2px solid ${INK}`, textDecoration: "none" }}>
                            <GitPullRequest className="size-3.5" />
                            View PR #{run.prNumber}
                          </a>
                        )}
                        {run.enzymes.length > 0 && (
                          <button onClick={() => setExpanded((p) => { const n = new Set(p); void (n.has(run.runId) ? n.delete(run.runId) : n.add(run.runId)); return n; })}
                            className="memphis-press p-1.5 cursor-pointer rounded-md"
                            style={{ background: "#fff", border: `2px solid ${INK}`, color: INK }}>
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
                        <div className="px-5 pb-5" style={{ borderTop: `2px dashed ${INK}22` }}>
                          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] mt-4 mb-3" style={{ color: `${INK}66` }}>Enzyme Actions</div>
                          <div className="flex flex-col gap-3">
                            {run.enzymes.map((ez, i) => {
                              const ec = ENZYME_CONFIG[ez.enzymeType];
                              return (
                                <div key={i} className="p-4 rounded-md" style={{ background: `${INK}05`, borderLeft: `3px solid ${ec.color}` }}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2 py-0.5 rounded-full uppercase" style={{ color: INK, background: "#fff", border: `1.5px solid ${INK}` }}>
                                      <EnzymeShape shape={ec.shape} color={ec.color} size={9} />
                                      {ez.enzymeType}
                                    </span>
                                    <span className="text-[11px] font-mono font-bold" style={{ color: `${INK}66` }}>{ez.targetZone}</span>
                                  </div>
                                  <div className="text-[12.5px] font-semibold leading-relaxed mb-2" style={{ color: `${INK}cc` }}>{ez.rationale}</div>
                                  {ez.diff && (
                                    <details>
                                      <summary className="text-[11px] font-bold cursor-pointer" style={{ color: `${INK}66` }}>View diff</summary>
                                      <pre className="mt-2 text-[10px] font-mono p-3 overflow-x-auto max-h-40 overflow-y-auto rounded-md"
                                        style={{ background: INK, color: "#f0ead8" }}>
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
        <div className="flex flex-col items-center justify-center py-16 relative overflow-hidden rounded-xl"
          style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: `6px 6px 0px ${INK}` }}>
          <div className="relative w-14 h-14 flex items-center justify-center mb-4"
            style={{ background: ACCENT.emerald, border: `2px solid ${INK}`, borderRadius: "50%" }}>
            <TrendingUp className="size-6" style={{ color: "#fff" }} />
          </div>
          <div className="relative text-[14px] font-extrabold mb-1" style={{ color: INK }}>No runs yet.</div>
          <div className="relative text-[12px] font-semibold" style={{ color: `${INK}66` }}>Click &ldquo;Measure &amp; Propose Enzyme&rdquo; to analyse entropy.</div>
        </div>
      )}

      <div className="-mx-6">
        <RuixenSection />
      </div>
    </div>
  );
}
