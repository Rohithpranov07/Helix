"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { motion, AnimatePresence } from "motion/react";
import { Zap, GitPullRequest, ChevronDown, ChevronUp, HeartPulse, Activity, AlertTriangle } from "lucide-react";
import { FeatureCarousel } from "@/components/ui/animated-feature-carousel";
import { Feature108 } from "@/components/ui/shadcnblocks-com-feature108";

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

// Shared light palette — black ink + flat accents, same language as the
// Logs / Immune / API Playground surfaces: white canvas, bold black borders,
// emerald/red/blue/amber accents, zero gradients or pastel tints.
const INK = "#18181b";
const ACCENT = { emerald: "#059669", red: "#dc2626", blue: "#2563eb", amber: "#d97706" };

// ── Background decoration — flat icon badges drawn from this page's own domain:
// reflex arcs (Zap), the nervous system (HeartPulse), incidents (AlertTriangle),
// and resulting patches (GitPullRequest). Zero gradient, ink outline only.
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

const STATUS_CONFIG = {
  pending_approval: { bg: ACCENT.amber, label: "PENDING APPROVAL" },
  approved: { bg: ACCENT.emerald, label: "APPROVED" },
  rejected: { bg: ACCENT.red, label: "REJECTED" },
  pr_created: { bg: ACCENT.emerald, label: "PR CREATED" },
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
        className="w-full appearance-none text-[13px] font-bold pl-4 pr-10 py-2.5 cursor-pointer focus:outline-none transition-colors duration-150 disabled:opacity-40 rounded-md"
        style={{ background: "#fff", border: `2px solid ${INK}`, color: INK }}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none" style={{ color: INK }} />
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
    <div ref={rootRef} className="max-w-5xl mx-auto px-6 pb-16 relative" style={{ paddingTop: 104, background: "#f1e6cf" }}>
      {/* Ambient page background — warm beige canvas, a faint grid, and scattered flat icon badges */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden", background: "#f1e6cf" }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(${INK}0d 1px, transparent 1px), linear-gradient(90deg, ${INK}0d 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        <BgBadge Icon={Zap} color={ACCENT.amber} size={60} style={{ top: "6%", left: "4%", transform: "rotate(-10deg)", opacity: 0.45 }} />
        <BgOutlineIcon Icon={HeartPulse} size={90} style={{ top: "16%", right: "6%", opacity: 0.22 }} />
        <BgBadge Icon={AlertTriangle} color={ACCENT.red} size={42} style={{ top: "50%", left: "2%", transform: "rotate(8deg)", opacity: 0.4 }} />
        <BgBadge Icon={GitPullRequest} color={ACCENT.blue} size={38} style={{ top: "62%", right: "10%", transform: "rotate(14deg)", opacity: 0.35 }} />
        <BgOutlineIcon Icon={Activity} size={54} style={{ bottom: "18%", left: "8%", opacity: 0.25 }} />
        <BgBadge Icon={HeartPulse} color={ACCENT.emerald} size={54} style={{ bottom: "8%", right: "5%", transform: "rotate(-6deg)", opacity: 0.4 }} />
      </div>

      {/* Header — bold black type, solid accent badge, no gradients or tilt */}
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
            Adaptive Incident Response
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          style={{
            fontSize: "clamp(2.2rem, 5.6vw, 4rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            margin: 0,
            fontWeight: 900,
            color: INK,
            textTransform: "uppercase",
          }}
        >
          Resurrection Reflex
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="mt-5 max-w-md text-[14px] leading-relaxed font-semibold"
          style={{ color: `${INK}99`, textWrap: "balance" as React.CSSProperties["textWrap"] }}
        >
          Detects Railway failures, reconstructs causal chains via Sarvam, and proposes minimal fixes — MTTR measured in seconds, not hours.
        </motion.p>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Incidents", value: patches.length, accent: INK },
          { label: "Pending", value: patches.filter((p) => p.status === "pending_approval").length, accent: ACCENT.amber },
          { label: "Resolved", value: totalResolved, accent: ACCENT.emerald },
          { label: "Projects", value: projects.length, accent: ACCENT.blue },
        ].map(({ label, value, accent }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            whileHover={{ y: -3, x: -3, boxShadow: `8px 8px 0px ${INK}` }}
            transition={{ duration: 0.4, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl p-4"
            style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: `5px 5px 0px ${INK}` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span style={{ width: 10, height: 10, background: accent, border: `2px solid ${INK}`, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: `${INK}99`, textTransform: "uppercase" }}>
                {label}
              </span>
            </div>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 36, fontWeight: 900, color: accent, lineHeight: 1 }}>
              {String(value).padStart(2, "0")}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Controls */}
      <motion.div
        className="reflex-controls rounded-xl p-5 mb-6"
        style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: `6px 6px 0px ${INK}` }}
        whileHover={{ y: -2, boxShadow: `8px 8px 0px ${INK}` }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: INK, textTransform: "uppercase", marginBottom: 16 }}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: ACCENT.emerald }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: ACCENT.emerald }} />
          </span>
          <span>
            Reflex Controls
            <span style={{ display: "block", width: 22, height: 4, background: ACCENT.blue, marginTop: 6 }} />
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <div className="text-[11px] font-bold mb-2" style={{ color: `${INK}99` }}>Railway Project</div>
            {!projectsLoaded ? (
              <button
                onClick={() => { void loadProjects(); }}
                className="w-full px-4 py-2.5 text-[13px] font-bold cursor-pointer text-left rounded-md"
                style={{ background: "#fff", border: `2px solid ${INK}66`, color: `${INK}99` }}
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
            <div className="text-[11px] font-bold mb-2" style={{ color: `${INK}99` }}>GitHub Repository</div>
            {connections.length === 0 ? (
              <div className="text-[12px] font-semibold py-2.5" style={{ color: `${INK}99` }}>
                Connect a repo in{" "}
                <Link href="/dashboard/genome" style={{ color: ACCENT.blue, textDecoration: "underline" }}>Genome</Link>
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
            className="memphis-press flex items-center gap-2 px-5 py-2.5 text-[13px] font-extrabold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed uppercase rounded-md"
            style={{ background: INK, color: "#fff", border: `2px solid ${INK}`, boxShadow: `0 0 0 3px ${ACCENT.emerald}26` }}
          >
            <Zap className="size-4" />
            {checking ? "Scanning…" : "Check Failures"}
          </button>
        </div>

        <AnimatePresence>
          {autoStatus && (
            <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: "auto", marginTop: 12 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="flex items-center gap-3 px-4 py-3 text-[13px] font-bold rounded-md"
              style={{ background: "#eff6ff", border: `1.5px solid ${ACCENT.blue}55`, color: "#1e3a8a" }}>
              <span style={{ width: 8, height: 8, background: ACCENT.blue, borderRadius: "50%", flexShrink: 0 }} />
              {autoStatus}
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
      </motion.div>

      {/* Patch list */}
      {patches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: `${INK}99` }}>
              {patches.length} incident patch{patches.length !== 1 ? "es" : ""}
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {patches.map((p) => {
              const sc = STATUS_CONFIG[p.status];
              const isExpanded = expanded.has(p.patchId);
              return (
                <motion.div
                  key={p.patchId}
                  whileHover={{ y: -3, x: -3, boxShadow: `8px 8px 0px ${INK}` }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="patch-card rounded-xl"
                  style={{ position: "relative", background: "#fff", border: `2px solid ${INK}`, borderLeftWidth: 5, borderLeftColor: sc.bg, boxShadow: `5px 5px 0px ${INK}`, overflow: "hidden" }}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[11px] font-mono font-bold" style={{ color: `${INK}88` }}>{p.patchId}</span>
                          <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase" style={{ background: sc.bg, color: "#fff", letterSpacing: "0.06em" }}>
                            {sc.label}
                          </span>
                        </div>
                        <div className="text-[11px] mb-2 font-bold" style={{ color: `${INK}66` }}>
                          {fmtAgo(p.detectedAt)} · deploy <span style={{ color: `${INK}99` }}>{p.railwayDeploymentId.slice(0, 8)}</span>
                          {" "}({p.deploymentStatus})
                        </div>
                        <div className="text-[14px] font-bold mb-3 leading-snug" style={{ color: INK }}>{p.failureSummary}</div>
                        {p.causalChain.slice(0, 2).map((s) => (
                          <div key={s.order} className="flex items-start gap-2 text-[12px] font-semibold mb-1" style={{ color: `${INK}88` }}>
                            <span style={{ flexShrink: 0, width: 16, height: 16, background: ACCENT.blue, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, borderRadius: 4 }}>{s.order}</span>
                            <span>{s.description}</span>
                            <span className="font-mono flex-shrink-0" style={{ color: `${INK}55` }}>[{s.evidenceRef}]</span>
                          </div>
                        ))}
                        {p.files.length > 0 && (
                          <div className="text-[11px] font-mono font-bold mt-2" style={{ color: `${INK}55` }}>
                            {p.files.length} file{p.files.length !== 1 ? "s" : ""}: {p.files.map((f) => f.path).join(", ")}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {p.status === "pending_approval" && (
                          <>
                            <button disabled={acting.has(p.patchId)} onClick={() => { void approve(p.patchId); }}
                              className="memphis-press px-3.5 py-1.5 text-[12px] font-extrabold cursor-pointer disabled:opacity-50 rounded-md"
                              style={{ background: ACCENT.emerald, color: "#fff", border: `2px solid ${INK}` }}>
                              {acting.has(p.patchId) ? "…" : "Approve & PR"}
                            </button>
                            <button disabled={acting.has(p.patchId)} onClick={() => { void reject(p.patchId); }}
                              className="memphis-press px-3.5 py-1.5 text-[12px] font-extrabold cursor-pointer disabled:opacity-50 rounded-md"
                              style={{ background: ACCENT.red, color: "#fff", border: `2px solid ${INK}` }}>
                              Reject
                            </button>
                          </>
                        )}
                        {p.status === "pr_created" && p.prUrl && (
                          <a href={p.prUrl} target="_blank" rel="noopener noreferrer"
                            className="memphis-press flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-extrabold rounded-md"
                            style={{ background: ACCENT.emerald, color: "#fff", border: `2px solid ${INK}`, textDecoration: "none" }}>
                            <GitPullRequest className="size-3.5" />
                            View PR #{p.prNumber}
                          </a>
                        )}
                        {p.causalChain.length > 0 && (
                          <button onClick={() => setExpanded((prev) => { const n = new Set(prev); void (n.has(p.patchId) ? n.delete(p.patchId) : n.add(p.patchId)); return n; })}
                            className="memphis-press p-1.5 cursor-pointer rounded-md"
                            style={{ background: "#fff", border: `2px solid ${INK}`, color: INK }}>
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
                        <div className="px-5 pb-5" style={{ borderTop: `2px dashed ${INK}22` }}>
                          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] mt-4 mb-3" style={{ color: `${INK}66` }}>Causal Chain</div>
                          <div className="relative pl-5">
                            <div className="absolute left-[7px] top-2 bottom-2 w-0 border-l-2 border-dashed" style={{ borderColor: `${INK}22` }} />
                            {p.causalChain.map((s) => (
                              <div key={s.order} className="relative flex gap-3 mb-3 last:mb-0">
                                <div className="absolute -left-[13px] top-0.5 flex-shrink-0 flex items-center justify-center"
                                  style={{ width: 14, height: 14, background: ACCENT.emerald, borderRadius: 4 }}>
                                  <span style={{ fontSize: 8, fontWeight: 900, color: "#fff" }}>{s.order}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[12.5px] font-semibold leading-snug" style={{ color: INK }}>{s.description}</div>
                                  <div className="text-[10px] font-mono font-bold mt-0.5" style={{ color: `${INK}55` }}>{s.evidenceRef}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {!patches.length && !checking && (
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center justify-center py-16 relative overflow-hidden rounded-xl"
          style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: `6px 6px 0px ${INK}` }}>
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="relative w-14 h-14 flex items-center justify-center mb-4"
            style={{ background: ACCENT.emerald, border: `2px solid ${INK}`, borderRadius: "50%" }}>
            <Zap className="size-6" style={{ color: "#fff" }} />
          </motion.div>
          <div className="relative text-[14px] font-extrabold mb-1" style={{ color: INK }}>No incidents recorded yet.</div>
          <div className="relative text-[12px] font-semibold" style={{ color: `${INK}66` }}>Select a Railway project and GitHub repo, then check for failures.</div>
        </motion.div>
      )}

      {/* How the Resurrection Reflex works — detect → diagnose → validate → heal */}
      <div className="mt-12">
        <div className="text-center mb-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em]" style={{ color: `${INK}77` }}>
            Nervous System
          </span>
        </div>
        <FeatureCarousel
          image={{
            alt: "HELIX reflex pipeline screenshot",
            step1img1: "/dash-reflex.jpg",
            step1img2: "/dash-immune.jpg",
            step2img1: "/dash-genome.jpg",
            step2img2: "/dash-metabolism.jpg",
            step3img: "/dash-shadow.jpg",
            step4img: "/dash-antibody.jpg",
          }}
        />
      </div>

      <Feature108 />
    </div>
  );
}
