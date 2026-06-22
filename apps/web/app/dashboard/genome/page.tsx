"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Dna, FolderGit2, Activity, AlertTriangle, GitBranch, FileSearch,
  Upload, Brain, Sparkles, Check, ArrowRight, X,
} from "lucide-react";

// ── Neo-Brutalism palette — shared with the Immune & Logs pages: flat beige
// canvas, thick ink borders, hard unblurred offset shadows, flat saturated
// accents, zero gradients/glow. ────────────────────────────────────────────────
const NEO = { yellow: "#ffe600", blue: "#2f5ef5", pink: "#ff3ea5", green: "#3ddc84", orange: "#ff7a1a", ink: "#0a0a0a" };

// ── Background decoration — flat icon badges drawn from the genome domain ───────
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

// ── Utils ──────────────────────────────────────────────────────────────────────
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
  if (s === "pending_approval") return NEO.yellow;
  if (s === "approved" || s === "pr_created") return NEO.green;
  if (s === "rejected") return NEO.pink;
  return `${NEO.ink}88`;
};

function parseGitHubUrl(raw: string): { owner: string; repo: string } | null {
  const s = raw.trim().replace(/\.git$/, "");
  const urlMatch = /github\.com\/([^/\s]+)\/([^/\s]+)/.exec(s);
  if (urlMatch) return { owner: urlMatch[1]!, repo: urlMatch[2]! };
  const slashMatch = /^([^/\s]+)\/([^/\s]+)$/.exec(s);
  if (slashMatch) return { owner: slashMatch[1]!, repo: slashMatch[2]! };
  return null;
}

// ── Module-level button styles ─────────────────────────────────────────────────
const btnOk: React.CSSProperties = { background: NEO.green, border: `2px solid ${NEO.ink}`, color: NEO.ink, padding: "5px 11px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: `3px 3px 0px ${NEO.ink}` };
const btnDng: React.CSSProperties = { background: NEO.pink, border: `2px solid ${NEO.ink}`, color: NEO.ink, padding: "5px 11px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: `3px 3px 0px ${NEO.ink}` };

const PIPELINE_STEPS = [
  { id: "01", title: "Architecture Scan", desc: "Traverse the repo tree, map module dependencies, detect invariant candidates.", Icon: GitBranch, color: NEO.blue },
  { id: "02", title: "Intent Mapping", desc: "Cross-reference your intent docs against every module to anchor expectations.", Icon: FileSearch, color: NEO.orange },
  { id: "03", title: "Genome Compile", desc: "Encode genetic invariants and write the baseline intent_strand to memory.", Icon: Dna, color: NEO.green },
] as const;

export default function GenomePage() {
  const [connections, setConnections] = useState<GitHubConnection[]>([]);
  const [drifts, setDrifts] = useState<DriftReport[]>([]);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [intentDocs] = useState("");
  const [intentDocsContent, setIntentDocsContent] = useState<string[]>([]);
  const [selectedConn, setSelectedConn] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [indexResult, setIndexResult] = useState<string | null>(null);
  const [indexedCount, setIndexedCount] = useState<number | undefined>(undefined);
  const [acting, setActing] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [mode, setMode] = useState<"deep-scan" | "fast-scan">("deep-scan");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/github/connections");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { connections?: GitHubConnection[] };
      if (json.connections) setConnections(json.connections);
    } catch (e) { setConnError(e instanceof Error ? e.message : "Failed to load connections"); }
  }, []);

  const loadDrifts = useCallback(async (o: string, r: string) => {
    try {
      const res = await fetch(`/api/reflex/genome-drifts?githubOwner=${encodeURIComponent(o)}&githubRepo=${encodeURIComponent(r)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { reports?: DriftReport[] };
      if (json.reports) setDrifts(json.reports);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load drift reports"); }
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(t);
  }, [error]);

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

  function connectOAuth(modelId: string = "deep-scan") {
    const o = owner.trim(), r = repo.trim();
    if (!o || !r) { setError("Enter owner + repo before connecting."); return; }

    const key = `${o}/${r}`;
    if (connections.some((c) => `${c.owner}/${c.repo}` === key)) {
      setSelectedConn(key);
      setOwner(o); setRepo(r);
      setDrifts([]);
      void loadDrifts(o, r);
      if (modelId === "deep-scan") {
        void (async () => { await runIndex(o, r); await runDrift(o, r); })();
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

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result && typeof ev.target.result === "string") {
        setIntentDocsContent((prev) => [...prev, ev.target!.result as string]);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const totalDrifted = drifts.filter((d) => d.status === "pending_approval").length;
  const isConnected = connections.some((c) => `${c.owner}/${c.repo}` === (repo && owner ? `${owner}/${repo}` : repo));

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "104px 24px 60px", position: "relative" }}>
      {/* Ambient page background — warm beige canvas, faint grid, scattered flat primitives */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden", background: "#f1e6cf" }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(${NEO.ink}0d 1px, transparent 1px), linear-gradient(90deg, ${NEO.ink}0d 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        <BgBadge Icon={Dna} color={NEO.blue} size={64} style={{ top: "6%", left: "4%", transform: "rotate(-12deg)", opacity: 0.5 }} />
        <BgOutlineIcon Icon={GitBranch} size={90} style={{ top: "14%", right: "6%", opacity: 0.22 }} />
        <BgBadge Icon={FolderGit2} color={NEO.green} size={44} style={{ top: "48%", left: "2%", transform: "rotate(8deg)", opacity: 0.4 }} />
        <BgBadge Icon={Activity} color={NEO.orange} size={40} style={{ top: "62%", right: "10%", transform: "rotate(14deg)", opacity: 0.35 }} />
        <BgOutlineIcon Icon={FileSearch} size={54} style={{ bottom: "18%", left: "8%", opacity: 0.25 }} />
        <BgBadge Icon={Dna} color={NEO.yellow} size={56} style={{ bottom: "8%", right: "5%", transform: "rotate(-6deg)", opacity: 0.45 }} />
        <BgBadge Icon={AlertTriangle} color={NEO.pink} size={32} style={{ top: "32%", left: "16%", transform: "rotate(10deg)", opacity: 0.3 }} />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
        style={{ marginBottom: 40, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 24 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
          className="neo-card inline-flex items-center gap-2 px-4 py-1.5"
          style={{ background: NEO.blue }}
        >
          <span style={{ width: 8, height: 8, background: NEO.ink, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: NEO.ink, textTransform: "uppercase" }}>
            Intent · Code Base-Pairing
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
          style={{ fontSize: "clamp(2.4rem, 6vw, 4.4rem)", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em", margin: "20px 0 0", color: NEO.ink, textTransform: "uppercase" }}
        >
          Genome
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
          style={{ fontSize: 14, color: `${NEO.ink}99`, lineHeight: 1.7, maxWidth: 540, fontWeight: 700, margin: "20px 0 0" }}
        >
          HELIX base-pairs every strand of declared intent against the code that implements it.
          When code drifts from what it was meant to do, the genome pinpoints exactly which
          modules diverged — and opens a shadow-proven PR to resync them.
        </motion.p>
      </motion.div>

      {/* Error banners */}
      {connError && (
        <div className="neo-card" style={{ background: NEO.pink, padding: "10px 14px", color: NEO.ink, fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
          OAuth error: {connError}
        </div>
      )}
      {error && (
        <div className="neo-card" style={{ background: NEO.pink, padding: "10px 14px", color: NEO.ink, fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {isConnecting ? (
        /* ── CONNECT PIPELINE ── */
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="neo-card"
          style={{ padding: 24 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: `${NEO.ink}99`, textTransform: "uppercase" }}>Genome Pipeline</span>
            <button onClick={() => setIsConnecting(false)} className="neo-press inline-flex items-center gap-1.5" style={{ background: "#fff", border: `2px solid ${NEO.ink}`, color: NEO.ink, padding: "5px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: `3px 3px 0px ${NEO.ink}` }}>
              <X size={13} strokeWidth={3} /> Cancel
            </button>
          </div>

          <div style={{ display: "grid", gap: 14, marginBottom: 22 }}>
            {PIPELINE_STEPS.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="neo-card"
                style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 16px", background: "#fff", boxShadow: `4px 4px 0px ${NEO.ink}` }}
              >
                <div style={{ width: 44, height: 44, flexShrink: 0, border: `2px solid ${NEO.ink}`, background: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <s.Icon size={22} style={{ color: NEO.ink }} strokeWidth={2.25} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 800, color: `${NEO.ink}66` }}>{s.id}</span>
                    <span style={{ fontSize: 15, fontWeight: 900, color: NEO.ink, textTransform: "uppercase", letterSpacing: "-0.01em" }}>{s.title}</span>
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: 12.5, fontWeight: 600, color: `${NEO.ink}99`, lineHeight: 1.5 }}>{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <button
            onClick={() => proceedWithConnect()}
            className="neo-press inline-flex items-center gap-2.5 w-full justify-center"
            style={{ background: NEO.green, border: `2px solid ${NEO.ink}`, color: NEO.ink, padding: "13px 20px", fontSize: 14, fontWeight: 900, cursor: "pointer", boxShadow: `4px 4px 0px ${NEO.ink}`, textTransform: "uppercase", letterSpacing: "0.02em" }}
          >
            <FolderGit2 size={18} strokeWidth={2.5} />
            Approve & Connect via GitHub
          </button>
        </motion.div>
      ) : (
        /* ── IDLE / CONNECTED ── */
        <>
          {/* Connect panel */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="neo-card neo-lift"
            style={{ padding: 24, marginBottom: 22 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: NEO.green }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: NEO.green }} />
              </span>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: NEO.ink, margin: 0, textTransform: "uppercase", letterSpacing: "-0.01em" }}>Map a Repository</h2>
            </div>
            <p style={{ fontSize: 13, color: `${NEO.ink}88`, margin: "0 0 18px", fontWeight: 700 }}>Paste a GitHub URL to base-pair its intent and monitor genetic drift.</p>

            {/* Input row */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                value={repo && owner ? `${owner}/${repo}` : repo}
                onChange={(e) => handleRepoInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") connectOAuth(mode); }}
                placeholder="https://github.com/octocat/my-repo"
                style={{ flex: 1, minWidth: 240, background: "#fff", border: `2px solid ${NEO.ink}`, color: NEO.ink, padding: "11px 14px", fontSize: 14, fontWeight: 700, outline: "none", boxShadow: `3px 3px 0px ${NEO.ink}` }}
              />
              <button
                onClick={() => connectOAuth(mode)}
                disabled={indexing || detecting}
                className="neo-press inline-flex items-center gap-2"
                style={{ background: NEO.blue, border: `2px solid ${NEO.ink}`, color: "#fff", padding: "11px 18px", fontSize: 14, fontWeight: 900, cursor: "pointer", boxShadow: `3px 3px 0px ${NEO.ink}`, textTransform: "uppercase" }}
              >
                {(indexing || detecting) ? "Working…" : isConnected ? "Run" : "Connect"}
                <ArrowRight size={16} strokeWidth={3} />
              </button>
            </div>

            {/* Mode + upload row */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
              {(["deep-scan", "fast-scan"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="neo-press inline-flex items-center gap-1.5"
                  style={{
                    background: mode === m ? NEO.yellow : "#fff",
                    border: `2px solid ${NEO.ink}`, color: NEO.ink, padding: "6px 12px",
                    fontSize: 11, fontWeight: 800, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em",
                    boxShadow: mode === m ? `3px 3px 0px ${NEO.ink}` : "none",
                  }}
                >
                  {m === "deep-scan" ? <Brain size={13} strokeWidth={2.5} /> : <Sparkles size={13} strokeWidth={2.5} />}
                  {m === "deep-scan" ? "Deep Scan" : "Fast Scan"}
                </button>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="neo-press inline-flex items-center gap-1.5"
                style={{ background: "#fff", border: `2px solid ${NEO.ink}80`, color: `${NEO.ink}cc`, padding: "6px 12px", fontSize: 11, fontWeight: 800, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em" }}
              >
                <Upload size={13} strokeWidth={2.5} />
                Upload intent doc{intentDocsContent.length > 0 ? ` (${intentDocsContent.length})` : ""}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".md,.txt,.json,.csv" />
            </div>

            {/* Connected repos */}
            {connections.length > 0 && (
              <div style={{ marginTop: 20, borderTop: `2px solid ${NEO.ink}1a`, paddingTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: `${NEO.ink}88`, textTransform: "uppercase", marginBottom: 10 }}>Connected Repositories</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {connections.slice(0, 6).map((c) => {
                    const key = `${c.owner}/${c.repo}`;
                    const sel = selectedConn === key;
                    return (
                      <button
                        key={key}
                        onClick={() => { setSelectedConn(key); setOwner(c.owner); setRepo(c.repo); setDrifts([]); void loadDrifts(c.owner, c.repo); }}
                        className="neo-press inline-flex items-center gap-2"
                        style={{ background: sel ? NEO.green : "#fff", border: `2px solid ${NEO.ink}`, color: NEO.ink, padding: "7px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: sel ? `3px 3px 0px ${NEO.ink}` : "none" }}
                      >
                        <FolderGit2 size={13} strokeWidth={2.5} />
                        {key}
                        {sel && <Check size={13} strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>

                {selectedConn && (
                  <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                    <button onClick={() => void runIndex()} disabled={indexing} className="neo-press inline-flex items-center gap-1.5" style={{ background: "#fff", border: `2px solid ${NEO.ink}`, color: NEO.ink, padding: "7px 13px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: `3px 3px 0px ${NEO.ink}` }}>
                      <Brain size={13} strokeWidth={2.5} /> {indexing ? "Indexing…" : "Index Repository"}
                    </button>
                    <button onClick={() => void runDrift()} disabled={detecting} className="neo-press inline-flex items-center gap-1.5" style={{ background: NEO.orange, border: `2px solid ${NEO.ink}`, color: NEO.ink, padding: "7px 13px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: `3px 3px 0px ${NEO.ink}` }}>
                      <Sparkles size={13} strokeWidth={2.5} /> {detecting ? "Detecting…" : "Detect Drift"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {indexResult && (
              <div style={{ marginTop: 16, background: NEO.green, border: `2px solid ${NEO.ink}`, padding: "10px 14px", color: NEO.ink, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                <Check size={15} strokeWidth={3} /> {indexResult}
              </div>
            )}
          </motion.div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
            {[
              { label: "Connected", value: connections.length, color: NEO.blue, id: "GEN-01" },
              { label: "Drift Reports", value: drifts.length, color: NEO.orange, id: "GEN-02" },
              { label: "Pending", value: totalDrifted, color: NEO.yellow, id: "GEN-03" },
              { label: "Indexed", value: indexedCount ?? 0, color: NEO.green, id: "GEN-04" },
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
                <div style={{ position: "absolute", top: 10, right: 12, fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 700, color: `${NEO.ink}55`, letterSpacing: "0.08em" }}>{id}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span style={{ width: 10, height: 10, background: color, border: `2px solid ${NEO.ink}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: `${NEO.ink}99`, textTransform: "uppercase" }}>{label}</span>
                </div>
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 36, fontWeight: 900, color, lineHeight: 1 }}>
                  {String(value).padStart(2, "0")}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Drift reports */}
          {drifts.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: `${NEO.ink}88`, fontWeight: 800, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {drifts.length} drift report{drifts.length !== 1 ? "s" : ""} — {totalDrifted} pending approval
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {drifts.map((d, di) => (
                  <motion.div
                    key={d.driftId}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.4, delay: Math.min(di, 6) * 0.06, ease: [0.22, 1, 0.36, 1] }}
                    className="neo-card neo-lift"
                    style={{ borderLeftWidth: 6, borderLeftColor: statusColor(d.status) }}
                  >
                    <div style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", fontWeight: 700, color: `${NEO.ink}88`, marginBottom: 4, wordBreak: "break-all" }}>{d.driftId}</div>
                          <div style={{ fontSize: 11, color: `${NEO.ink}66`, fontWeight: 600 }}>
                            {fmtAgo(d.detectedAt)} · shadow: <span style={{ fontFamily: "ui-monospace, monospace", color: `${NEO.ink}99` }}>{d.shadowBranch}</span>
                          </div>
                          {d.mismatches.length > 0 && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                              {d.mismatches.map((m, i) => (
                                <span key={i} style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", background: NEO.yellow, color: NEO.ink, border: `2px solid ${NEO.ink}` }}>
                                  {m.invariantId}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: NEO.ink, padding: "2px 8px", background: statusColor(d.status), border: `2px solid ${NEO.ink}`, display: "inline-flex", alignItems: "center", gap: 5 }}>
                            {d.status === "pending_approval" && (
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: NEO.ink, opacity: 0.5 }} />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: NEO.ink }} />
                              </span>
                            )}
                            {d.status.replace(/_/g, " ").toUpperCase()}
                          </span>
                          {d.status === "pending_approval" && (
                            <>
                              <button className="neo-press" style={btnOk} disabled={acting.has(d.driftId)} onClick={() => { void approve(d.driftId); }}>
                                {acting.has(d.driftId) ? "…" : "Approve & PR"}
                              </button>
                              <button className="neo-press" style={btnDng} disabled={acting.has(d.driftId)} onClick={() => { void reject(d.driftId); }}>Reject</button>
                            </>
                          )}
                          {d.status === "pr_created" && d.prUrl && (
                            <a href={d.prUrl} target="_blank" rel="noopener noreferrer" className="neo-press" style={{ ...btnOk, textDecoration: "none", fontSize: 12 }}>
                              View PR #{d.prNumber}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {d.mismatches.length > 0 && (
                      <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                        {d.mismatches.map((m, i) => (
                          <div key={`${m.invariantId}-${i}`} style={{ background: NEO.ink, padding: "12px 14px", borderLeft: `3px solid ${NEO.orange}` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: NEO.orange, fontFamily: "ui-monospace, monospace" }}>[{m.invariantId}]</span>
                              <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#999" }}>{m.affectedFile}</span>
                            </div>
                            <div style={{ fontSize: 12, color: "#ccc", fontWeight: 600 }}>{m.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {selectedConn && drifts.length === 0 && !detecting && (
            <div style={{ color: `${NEO.ink}66`, fontSize: 13, fontWeight: 700, textAlign: "center", padding: "40px 0" }}>
              No drift reports for {selectedConn}. Index the repo, then run Detect Drift.
            </div>
          )}
          {!selectedConn && connections.length === 0 && (
            <div style={{ color: `${NEO.ink}66`, fontSize: 13, fontWeight: 700, textAlign: "center", padding: "40px 0" }}>
              Connect a GitHub repository above to start monitoring genetic integrity.
            </div>
          )}
        </>
      )}

      {/* ── Explainer ── */}
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
        style={{ marginTop: 72, position: "relative" }}
      >
        {/* Backdrop — flat neo decoration sitting behind the headline + text */}
        <div aria-hidden style={{ position: "absolute", inset: "-40px -24px 0", zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
          {/* Giant faint outline wordmark */}
          <span style={{ position: "absolute", top: 40, left: -8, fontSize: "clamp(5rem, 16vw, 12rem)", fontWeight: 900, lineHeight: 0.8, letterSpacing: "-0.04em", color: "transparent", WebkitTextStroke: `2px ${NEO.ink}10`, textTransform: "uppercase", userSelect: "none" }}>
            INTENT
          </span>
          {/* Dot-grid panel behind the copy */}
          <div style={{ position: "absolute", top: 0, right: 0, width: 360, height: 300, backgroundImage: `radial-gradient(${NEO.ink}1f 1.5px, transparent 1.5px)`, backgroundSize: "16px 16px", maskImage: "radial-gradient(70% 70% at 70% 30%, #000, transparent 75%)", WebkitMaskImage: "radial-gradient(70% 70% at 70% 30%, #000, transparent 75%)" }} />
          {/* Big faint DNA glyph, top-right */}
          <Dna size={220} strokeWidth={1.25} style={{ position: "absolute", top: -10, right: 12, color: `${NEO.ink}12`, transform: "rotate(8deg)" }} />
          {/* Flat accent squares */}
          <div style={{ position: "absolute", top: 18, right: 220, width: 38, height: 38, background: NEO.blue, border: `3px solid ${NEO.ink}`, transform: "rotate(-10deg)", opacity: 0.5 }} />
          <div style={{ position: "absolute", bottom: 40, left: 200, width: 26, height: 26, background: NEO.pink, border: `3px solid ${NEO.ink}`, transform: "rotate(12deg)", opacity: 0.45 }} />
          <div style={{ position: "absolute", top: 120, left: 320, width: 18, height: 18, background: NEO.green, border: `2px solid ${NEO.ink}`, transform: "rotate(6deg)", opacity: 0.5 }} />
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
        <motion.div
          variants={{ hidden: { opacity: 0, y: 20, filter: "blur(6px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } }}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 18 }}
          className="neo-card"
        >
          <span style={{ background: NEO.yellow, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, background: NEO.ink }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: NEO.ink, textTransform: "uppercase" }}>The Genome</span>
          </span>
        </motion.div>
        <motion.h2
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.08 } } }}
          style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)", fontWeight: 900, lineHeight: 1.02, letterSpacing: "-0.03em", color: NEO.ink, textTransform: "uppercase", margin: "0 0 16px", maxWidth: 760 }}
        >
          {"It remembers what you meant.".split(" ").map((word, i) => (
            <span
              key={i}
              style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", paddingBottom: "0.14em", marginBottom: "-0.14em", marginRight: "0.26em" }}
            >
              <motion.span
                style={{ display: "inline-block", willChange: "transform" }}
                variants={{ hidden: { y: "115%" }, show: { y: "0%", transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } } }}
              >
                {word}
              </motion.span>
            </span>
          ))}
        </motion.h2>
        <motion.p
          variants={{ hidden: { opacity: 0, y: 20, filter: "blur(6px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } }}
          style={{ fontSize: 15, color: `${NEO.ink}aa`, fontWeight: 600, lineHeight: 1.7, maxWidth: 620, margin: "0 0 28px" }}
        >
          HELIX reads your repository and extracts its intent — the promise each module is meant to keep —
          then base-pairs every strand of intent against the code that actually implements it. When the
          code drifts, the pairing breaks, and the genome resyncs it before drift compounds into entropy.
        </motion.p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {["/dash-genome.jpg", "/dash-reflex.jpg", "/dash-metabolism.jpg", "/dash-shadow.jpg"].map((src, i) => (
            <motion.div
              key={src}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="neo-card neo-lift"
              style={{ overflow: "hidden", padding: 0 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Genome lifecycle ${i + 1}`} style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
            </motion.div>
          ))}
        </div>
        </div>
      </motion.div>

      {/* ── Comparison ── */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginTop: 64 }}
        className="neo-card"
      >
        <div style={{ padding: "26px 24px 8px", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 900, color: NEO.ink, textTransform: "uppercase", letterSpacing: "-0.02em", margin: 0 }}>Genome vs. Guesswork</h2>
          <p style={{ fontSize: 13, color: `${NEO.ink}88`, fontWeight: 700, margin: "8px 0 0" }}>Living intent-tracking vs. hoping nobody broke the spec.</p>
        </div>
        <motion.div
          style={{ position: "relative", padding: "10px 24px 28px", display: "flex", gap: 18, alignItems: "stretch", flexWrap: "wrap" }}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } } }}
        >
          {(() => {
            const ROWS = [
              { feature: "Intent Capture", yours: "Auto base-paired", theirs: "Tribal knowledge" },
              { feature: "Drift Detection", yours: "Continuous", theirs: "On PR, maybe" },
              { feature: "Pinpoint Module", yours: "Exact strand", theirs: "Grep + pray" },
              { feature: "Resync", yours: "Shadow-proven PR", theirs: "Hotfix Friday" },
              { feature: "Entropy Over Time", yours: "Held flat", theirs: "Compounds" },
              { feature: "Coverage", yours: "Every commit", theirs: "Whoever's awake" },
            ];
            const ROW_H = 60;

            const Row = ({ feature, value, win }: { feature: string; value: string; win: boolean }) => (
              <div style={{ display: "flex", alignItems: "center", gap: 11, minHeight: ROW_H, padding: "0 18px", borderTop: `1px solid ${NEO.ink}1a` }}>
                <span style={{ width: 24, height: 24, flexShrink: 0, border: `2px solid ${NEO.ink}`, background: win ? NEO.green : NEO.pink, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {win ? <Check size={14} strokeWidth={3.5} style={{ color: NEO.ink }} /> : <X size={14} strokeWidth={3.5} style={{ color: NEO.ink }} />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: `${NEO.ink}66`, textTransform: "uppercase" }}>{feature}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: win ? NEO.ink : `${NEO.ink}88`, lineHeight: 1.2, marginTop: 2 }}>{value}</div>
                </div>
              </div>
            );

            return (
              <>
                {/* HELIX card — the winner, elevated */}
                <motion.div
                  variants={{ hidden: { opacity: 0, x: -28 }, show: { opacity: 1, x: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
                  className="neo-card neo-lift"
                  style={{ flex: "1 1 280px", position: "relative", padding: 0, overflow: "visible", boxShadow: `8px 8px 0px ${NEO.ink}` }}
                >
                  {/* RECOMMENDED tag */}
                  <div style={{ position: "absolute", top: -14, right: -10, zIndex: 2, transform: "rotate(4deg)", background: NEO.yellow, border: `2px solid ${NEO.ink}`, boxShadow: `3px 3px 0px ${NEO.ink}`, padding: "4px 10px", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: NEO.ink, textTransform: "uppercase" }}>
                    ★ Recommended
                  </div>
                  {/* Header */}
                  <div style={{ background: NEO.green, borderBottom: `3px solid ${NEO.ink}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 8 }}>
                    <Dna size={18} strokeWidth={2.5} style={{ color: NEO.ink }} />
                    <span style={{ fontSize: 14, fontWeight: 900, color: NEO.ink, textTransform: "uppercase", letterSpacing: "-0.01em" }}>HELIX Genome</span>
                  </div>
                  {ROWS.map((r) => <Row key={r.feature} feature={r.feature} value={r.yours} win />)}
                </motion.div>

                {/* Center VS badge */}
                <div aria-hidden style={{ position: "absolute", left: "50%", top: "52%", transform: "translate(-50%,-50%) rotate(-6deg)", zIndex: 3, width: 46, height: 46, borderRadius: "50%", background: NEO.ink, color: "#fff", border: `2px solid ${NEO.ink}`, boxShadow: `0 0 0 4px #fff, 4px 4px 0 ${NEO.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, letterSpacing: "0.02em" }}>
                  VS
                </div>

                {/* MANUAL card — flat, muted */}
                <motion.div
                  variants={{ hidden: { opacity: 0, x: 28 }, show: { opacity: 1, x: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
                  className="neo-card"
                  style={{ flex: "1 1 280px", padding: 0, overflow: "hidden", background: "#f5efe2", boxShadow: `4px 4px 0px ${NEO.ink}40`, opacity: 0.96 }}
                >
                  {/* Header */}
                  <div style={{ background: "#e7dcc6", borderBottom: `3px solid ${NEO.ink}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertTriangle size={18} strokeWidth={2.5} style={{ color: `${NEO.ink}88` }} />
                    <span style={{ fontSize: 14, fontWeight: 900, color: `${NEO.ink}88`, textTransform: "uppercase", letterSpacing: "-0.01em" }}>Manual Review</span>
                  </div>
                  {ROWS.map((r) => <Row key={r.feature} feature={r.feature} value={r.theirs} win={false} />)}
                </motion.div>
              </>
            );
          })()}
        </motion.div>
      </motion.div>
    </div>
  );
}
