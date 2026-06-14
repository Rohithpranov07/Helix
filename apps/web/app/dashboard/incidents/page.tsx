"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { motion, AnimatePresence } from "motion/react";
import { Zap, GitPullRequest, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Clock, Layers } from "lucide-react";
import { HandWrittenTitle } from "@/components/ui/hand-writing-text";
import { cn } from "@/lib/utils";

function fmtAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

interface RailwayProject { id: string; name: string; }
interface GitHubConnection { owner: string; repo: string; }
interface IncidentPatchCausalStep { order: number; description: string; evidenceRef: string; }
interface IncidentPatchFile { path: string; diff: string; newContent: string; }
interface IncidentPatch {
  patchId: string; incidentId: string; githubOwner: string; githubRepo: string;
  railwayProjectId: string; railwayDeploymentId: string; deploymentStatus: string;
  shadowBranch: string; detectedAt: string; failureSummary: string;
  causalChain: IncidentPatchCausalStep[]; files: IncidentPatchFile[];
  status: "pending_approval" | "approved" | "rejected" | "pr_created";
  prUrl?: string; prNumber?: number;
}

const STATUS_CONFIG = {
  pending_approval: { color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.25)", label: "PENDING APPROVAL" },
  approved: { color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)", label: "APPROVED" },
  rejected: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)", label: "REJECTED" },
  pr_created: { color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)", label: "PR CREATED" },
};

function StyledSelect({ value, onChange, children, disabled }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none rounded-xl border text-[13px] text-white/80 pl-4 pr-10 py-2.5 cursor-pointer focus:outline-none focus:border-white/20 transition-colors duration-200 disabled:opacity-40"
        style={{ background: "#0c0c10", borderColor: "rgba(255,255,255,0.08)" }}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-white/30 pointer-events-none" />
    </div>
  );
}

export default function IncidentsPage() {
  const [projects, setProjects] = useState<RailwayProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [connections, setConnections] = useState<GitHubConnection[]>([]);
  const [selectedConn, setSelectedConn] = useState<string | null>(null);
  const [patches, setPatches] = useState<IncidentPatch[]>([]);
  const [checking, setChecking] = useState(false);
  const [acting, setActing] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const didAnimate = useRef(false);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/reflex/railway-projects");
      const json = await res.json() as { projects?: RailwayProject[] };
      if (json.projects) { setProjects(json.projects); setProjectsLoaded(true); }
    } catch { /* ignore */ }
  }, []);

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/github/connections");
      const json = await res.json() as { connections?: GitHubConnection[] };
      if (json.connections) setConnections(json.connections);
    } catch { /* ignore */ }
  }, []);

  const loadPatches = useCallback(async (o: string, r: string) => {
    try {
      const res = await fetch(`/api/reflex/incident-patches?githubOwner=${encodeURIComponent(o)}&githubRepo=${encodeURIComponent(r)}`);
      const json = await res.json() as { patches?: IncidentPatch[] };
      if (json.patches) setPatches(json.patches);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadProjects(); void loadConnections(); }, [loadProjects, loadConnections]);
  useEffect(() => {
    if (!selectedConn) return;
    const [o, r] = selectedConn.split("/") as [string, string];
    void loadPatches(o, r);
  }, [selectedConn, loadPatches]);

  useEffect(() => {
    if (didAnimate.current) return;
    didAnimate.current = true;
    const ctx = gsap.context(() => {
      gsap.from(".reflex-stat", { opacity: 0, y: 16, scale: 0.94, duration: 0.4, stagger: 0.07, ease: "back.out(1.4)", delay: 0.1 });
      gsap.from(".reflex-controls", { opacity: 0, y: 12, duration: 0.4, ease: "power2.out", delay: 0.3 });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // Stagger patch cards when they load
  useEffect(() => {
    if (!patches.length) return;
    const ctx = gsap.context(() => {
      gsap.from(".patch-card", { opacity: 0, y: 20, duration: 0.4, stagger: 0.08, ease: "power2.out" });
    }, rootRef);
    return () => ctx.revert();
  }, [patches.length]);

  async function checkFailures() {
    if (!selectedProject || !selectedConn) { setError("Select a Railway project and a GitHub repo."); return; }
    const [o, r] = selectedConn.split("/") as [string, string];
    setChecking(true); setError(null); setAutoStatus("Scanning Railway for failed deployments…");
    try {
      const res = await fetch("/api/reflex/railway-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProject, githubOwner: o, githubRepo: r }),
      });
      const json = await res.json() as { patch?: IncidentPatch; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.patch) setPatches((prev) => [json.patch!, ...prev.filter((p) => p.patchId !== json.patch!.patchId)]);
      setAutoStatus(null);
    } catch (e) { setError(e instanceof Error ? e.message : "check failed"); setAutoStatus(null); }
    finally { setChecking(false); }
  }

  async function approve(patchId: string) {
    setActing((s) => new Set(s).add(patchId));
    try {
      const res = await fetch("/api/reflex/incident-approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patchId }) });
      const json = await res.json() as { patch?: IncidentPatch; error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      if (json.patch) setPatches((prev) => prev.map((p) => p.patchId === patchId ? json.patch! : p));
    } catch (e) { setError(e instanceof Error ? e.message : "approve failed"); }
    finally { setActing((s) => { const n = new Set(s); n.delete(patchId); return n; }); }
  }

  async function reject(patchId: string) {
    setActing((s) => new Set(s).add(patchId));
    try {
      const res = await fetch("/api/reflex/incident-reject", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patchId }) });
      const json = await res.json() as { error?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      setPatches((prev) => prev.map((p) => p.patchId === patchId ? { ...p, status: "rejected" as const } : p));
    } catch (e) { setError(e instanceof Error ? e.message : "reject failed"); }
    finally { setActing((s) => { const n = new Set(s); n.delete(patchId); return n; }); }
  }

  const totalResolved = patches.filter((p) => p.status === "pr_created" || p.status === "approved").length;

  return (
    <div ref={rootRef} className="max-w-5xl mx-auto px-6 pb-16 pt-2">
      <HandWrittenTitle
        title="Resurrection Reflex"
        subtitle="Detects Railway failures, reconstructs causal chains via Sarvam, proposes minimal fixes. MTTR in seconds."
        color="#a78bfa"
      />

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Incidents", value: patches.length, color: "#f1f5f9", Icon: Layers },
          { label: "Pending", value: patches.filter((p) => p.status === "pending_approval").length, color: "#f97316", Icon: Clock },
          { label: "Resolved", value: totalResolved, color: "#22c55e", Icon: CheckCircle },
          { label: "Projects", value: projects.length, color: "#a78bfa", Icon: AlertTriangle },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="reflex-stat rounded-xl p-4 border" style={{ background: "rgba(14,14,18,0.8)", borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</div>
              <Icon className="size-3.5" style={{ color, opacity: 0.6 }} />
            </div>
            <div className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="reflex-controls rounded-2xl border p-5 mb-6" style={{ background: "rgba(14,14,18,0.8)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30 mb-4">Reflex Controls</div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <div className="text-[11px] text-white/40 mb-2">Railway Project</div>
            {!projectsLoaded ? (
              <button
                onClick={() => { void loadProjects(); }}
                className="w-full px-4 py-2.5 rounded-xl text-[13px] text-white/50 border border-white/08 hover:border-white/15 hover:text-white/70 transition-all duration-200 cursor-pointer text-left"
                style={{ background: "#0c0c10" }}
              >
                Load Railway Projects…
              </button>
            ) : (
              <StyledSelect value={selectedProject ?? ""} onChange={(v) => setSelectedProject(v || null)}>
                <option value="">— select project —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </StyledSelect>
            )}
          </div>
          <div>
            <div className="text-[11px] text-white/40 mb-2">GitHub Repository</div>
            {connections.length === 0 ? (
              <div className="text-[12px] text-white/30 py-2.5">
                Connect a repo in{" "}
                <Link href="/dashboard/genome" className="text-violet-400 hover:text-violet-300 transition-colors">Genome</Link>
                {" "}first.
              </div>
            ) : (
              <StyledSelect value={selectedConn ?? ""} onChange={(v) => setSelectedConn(v || null)}>
                <option value="">— select repo —</option>
                {connections.map((c) => { const k = `${c.owner}/${c.repo}`; return <option key={k} value={k}>{k}</option>; })}
              </StyledSelect>
            )}
          </div>
          <button
            onClick={() => { void checkFailures(); }}
            disabled={checking || !selectedProject || !selectedConn}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#6d28d9", color: "#fff", boxShadow: "0 0 20px rgba(109,40,217,0.3)" }}
          >
            <Zap className="size-4" />
            {checking ? "Scanning…" : "Check Failures"}
          </button>
        </div>

        <AnimatePresence>
          {autoStatus && (
            <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: "auto", marginTop: 12 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border text-[13px]"
              style={{ background: "rgba(109,40,217,0.08)", borderColor: "rgba(109,40,217,0.2)", color: "#c4b5fd" }}>
              <span className="relative flex size-2 flex-shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75 animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-violet-400" />
              </span>
              {autoStatus}
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

      {/* Patch list */}
      {patches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/30">
              {patches.length} incident patch{patches.length !== 1 ? "es" : ""}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {patches.map((p) => {
              const sc = STATUS_CONFIG[p.status];
              const isExpanded = expanded.has(p.patchId);
              return (
                <div key={p.patchId} className="patch-card rounded-2xl border overflow-hidden"
                  style={{ background: "rgba(14,14,18,0.8)", borderColor: "rgba(255,255,255,0.06)", borderLeft: `3px solid ${sc.color}` }}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[11px] font-mono text-white/40">{p.patchId}</span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded"
                            style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>
                            {sc.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-white/30 mb-2 font-mono">
                          {fmtAgo(p.detectedAt)} · deploy <span className="text-white/40">{p.railwayDeploymentId.slice(0, 8)}</span>
                          {" "}({p.deploymentStatus})
                        </div>
                        <div className="text-[14px] text-white/80 font-medium mb-3 leading-snug">{p.failureSummary}</div>
                        {p.causalChain.slice(0, 2).map((s) => (
                          <div key={s.order} className="flex items-start gap-2 text-[12px] text-white/35 mb-1">
                            <span className="font-bold text-violet-400/70 flex-shrink-0">{s.order}.</span>
                            <span>{s.description}</span>
                            <span className="font-mono text-white/20 flex-shrink-0">[{s.evidenceRef}]</span>
                          </div>
                        ))}
                        {p.files.length > 0 && (
                          <div className="text-[11px] text-white/25 mt-2 font-mono">
                            {p.files.length} file{p.files.length !== 1 ? "s" : ""}: {p.files.map((f) => f.path).join(", ")}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {p.status === "pending_approval" && (
                          <>
                            <button disabled={acting.has(p.patchId)} onClick={() => { void approve(p.patchId); }}
                              className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50"
                              style={{ background: "rgba(34,197,94,0.1)", color: "#86efac", border: "1px solid rgba(34,197,94,0.25)" }}>
                              {acting.has(p.patchId) ? "…" : "Approve & PR"}
                            </button>
                            <button disabled={acting.has(p.patchId)} onClick={() => { void reject(p.patchId); }}
                              className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50"
                              style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.25)" }}>
                              Reject
                            </button>
                          </>
                        )}
                        {p.status === "pr_created" && p.prUrl && (
                          <a href={p.prUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200"
                            style={{ background: "rgba(34,197,94,0.1)", color: "#86efac", border: "1px solid rgba(34,197,94,0.25)", textDecoration: "none" }}>
                            <GitPullRequest className="size-3.5" />
                            View PR #{p.prNumber}
                          </a>
                        )}
                        {p.causalChain.length > 0 && (
                          <button onClick={() => setExpanded((prev) => { const n = new Set(prev); n.has(p.patchId) ? n.delete(p.patchId) : n.add(p.patchId); return n; })}
                            className="p-1.5 rounded-lg transition-all duration-200 cursor-pointer"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                            {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Causal chain */}
                  <AnimatePresence>
                    {isExpanded && p.causalChain.length > 0 && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                        <div className="px-5 pb-5 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/25 mt-4 mb-3">Causal Chain</div>
                          <div className="relative pl-5">
                            <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-white/[0.06]" />
                            {p.causalChain.map((s) => (
                              <div key={s.order} className="relative flex gap-3 mb-3 last:mb-0">
                                <div className="absolute left-[-13px] top-1.5 w-3 h-3 rounded-full border flex-shrink-0 flex items-center justify-center"
                                  style={{ background: "#0e0e12", borderColor: "rgba(167,139,250,0.4)" }}>
                                  <div className="w-1 h-1 rounded-full bg-violet-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[12.5px] text-white/70 leading-snug">{s.description}</div>
                                  <div className="text-[10px] font-mono text-white/25 mt-0.5">{s.evidenceRef}</div>
                                </div>
                              </div>
                            ))}
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

      {!patches.length && !checking && (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border"
          style={{ background: "rgba(14,14,18,0.6)", borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center mb-4">
            <Zap className="size-5 text-white/20" />
          </div>
          <div className="text-[13px] text-white/30 mb-1">No incidents recorded.</div>
          <div className="text-[11px] text-white/15">Select a Railway project and GitHub repo, then check for failures.</div>
        </div>
      )}
    </div>
  );
}
