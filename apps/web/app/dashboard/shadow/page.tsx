"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronUp, CheckCircle, XCircle, BarChart3, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Component as StandardCard } from "@/components/ui/standard-card";

// Shared light palette — black ink + flat accents, same language as the
// Logs / Immune / Reflex / Metabolism / API Playground surfaces: white
// canvas, bold black borders, emerald/red/blue/amber accents, zero
// gradients or pastel tints.
const INK = "#18181b";
const ACCENT = { emerald: "#059669", red: "#dc2626", blue: "#2563eb", amber: "#d97706" };

// ── Background decoration — flat icon badges drawn from this page's own domain:
// shadow proofs (Shield), promote/reject verdicts (CheckCircle, XCircle), and
// replay stats (BarChart3). Zero gradient, ink outline only.
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

interface ShadowProof {
  proofId: string;
  changeRef: string;
  verdict: "promote" | "reject";
  verifiedAt: string;
  replayedCases: number;
  intendedFixPassed: boolean;
  regressions: number;
}

function fmtAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

const DEMO_PROOFS: ShadowProof[] = [
  { proofId: "sha-a3f9b3c", changeRef: "fix/checkout-null-ref",     verdict: "promote", verifiedAt: new Date(Date.now() - 7200000).toISOString(),   replayedCases: 15, intendedFixPassed: true,  regressions: 0 },
  { proofId: "sha-8e2d1a4", changeRef: "fix/sqli-search-endpoint",  verdict: "promote", verifiedAt: new Date(Date.now() - 86400000).toISOString(),   replayedCases: 12, intendedFixPassed: true,  regressions: 0 },
  { proofId: "sha-f4c9b20", changeRef: "fix/xss-comment-field",     verdict: "reject",  verifiedAt: new Date(Date.now() - 172800000).toISOString(), replayedCases: 8,  intendedFixPassed: false, regressions: 2 },
];

export default function ShadowPage() {
  const [proofs, setProofs] = useState<ShadowProof[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const didAnimate = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/vitals");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { snapshot?: { recentShadowProofs?: ShadowProof[] } };
        const proofList = json.snapshot?.recentShadowProofs;
        if (proofList && proofList.length > 0) {
          setProofs(proofList);
        } else {
          setProofs(DEMO_PROOFS);
          setDemoMode(true);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load shadow proofs";
        if (msg.startsWith("HTTP")) {
          setFetchError(msg);
          setProofs([]);
        } else {
          setProofs(DEMO_PROOFS);
          setDemoMode(true);
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (didAnimate.current) return;
    didAnimate.current = true;
    const ctx = gsap.context(() => {
      gsap.from(".shadow-stat", { opacity: 0, y: 16, scale: 0.93, duration: 0.4, stagger: 0.07, ease: "back.out(1.4)", delay: 0.1 });
      gsap.from(".shadow-banner", { opacity: 0, y: 8, duration: 0.4, ease: "power2.out", delay: 0.35 });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!proofs.length || loading) return;
    const ctx = gsap.context(() => {
      gsap.from(".proof-card", { opacity: 0, y: 18, duration: 0.4, stagger: 0.09, ease: "power2.out" });
    }, rootRef);
    return () => ctx.revert();
  }, [proofs.length, loading]);

  const promoted = proofs.filter((p) => p.verdict === "promote").length;
  const rejected  = proofs.filter((p) => p.verdict === "reject").length;
  const passRate  = proofs.length ? Math.round((promoted / proofs.length) * 100) : null;

  return (
    <div ref={rootRef} className="max-w-5xl mx-auto px-6 pb-16 relative" style={{ paddingTop: 104, background: "#f1e6cf" }}>
      {/* Ambient page background — warm beige canvas, a faint grid, and scattered flat icon badges */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden", background: "#f1e6cf" }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(${INK}0d 1px, transparent 1px), linear-gradient(90deg, ${INK}0d 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        <BgBadge Icon={Shield} color={ACCENT.blue} size={60} style={{ top: "6%", left: "4%", transform: "rotate(-10deg)", opacity: 0.45 }} />
        <BgOutlineIcon Icon={BarChart3} size={90} style={{ top: "16%", right: "6%", opacity: 0.22 }} />
        <BgBadge Icon={CheckCircle} color={ACCENT.emerald} size={42} style={{ top: "50%", left: "2%", transform: "rotate(8deg)", opacity: 0.4 }} />
        <BgBadge Icon={XCircle} color={ACCENT.red} size={38} style={{ top: "62%", right: "10%", transform: "rotate(14deg)", opacity: 0.35 }} />
        <BgOutlineIcon Icon={Shield} size={54} style={{ bottom: "18%", left: "8%", opacity: 0.25 }} />
        <BgBadge Icon={BarChart3} color={ACCENT.amber} size={54} style={{ bottom: "8%", right: "5%", transform: "rotate(-6deg)", opacity: 0.4 }} />
      </div>

      {/* Header — raw chunky type, no gradients, no italics */}
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
            Verified Before Promotion
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          style={{ fontSize: "clamp(2.2rem, 5.6vw, 4rem)", lineHeight: 1, letterSpacing: "-0.03em", margin: 0, fontWeight: 900, color: INK, textTransform: "uppercase" }}
        >
          Shadow Proofs
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="mt-4 max-w-md text-[14px] leading-relaxed font-bold"
          style={{ color: `${INK}99`, textWrap: "balance" as React.CSSProperties["textWrap"] }}
        >
          Every code change verified in Shadow before promotion. No patch reaches production without a stored PROMOTE proof.
        </motion.p>
      </motion.div>

      {/* Fetch error */}
      {fetchError && (
        <div className="flex items-center gap-2.5 px-4 py-3 text-[12px] mb-5 font-bold rounded-md"
          style={{ color: "#b91c1c", background: "#fef2f2", border: `1.5px solid ${ACCENT.red}55` }}>
          <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5 shrink-0"><path d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6a1 1 0 110 2 1 1 0 010-2z"/></svg>
          Failed to load proofs: {fetchError}
        </div>
      )}

      {/* Demo notice */}
      {demoMode && (
        <div className="flex items-center gap-2.5 px-4 py-3 text-[12px] mb-5 font-bold rounded-md"
          style={{ color: "#92400e", background: "#fffbeb", border: `1.5px solid ${ACCENT.amber}55` }}>
          <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5 shrink-0"><path d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6a1 1 0 110 2 1 1 0 010-2z"/></svg>
          Showing demo proof data — live data requires MongoDB.
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Proofs",   value: proofs.length, color: INK, Icon: BarChart3 },
          { label: "Promoted",       value: promoted,      color: ACCENT.emerald, Icon: CheckCircle },
          { label: "Rejected",       value: rejected,      color: rejected > 0 ? ACCENT.red : "#9a9a9a", Icon: XCircle },
          { label: "Pass Rate",      value: passRate !== null ? `${passRate}%` : "—", color: ACCENT.blue, Icon: Shield },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="shadow-stat rounded-xl p-4" style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: `5px 5px 0px ${INK}` }}>
            <div className="flex items-center justify-between mb-3">
              <Icon className="size-3.5" style={{ color: INK, opacity: 0.7 }} />
              <span style={{ width: 10, height: 10, background: color, border: `2px solid ${INK}`, flexShrink: 0 }} />
            </div>
            <div className="text-2xl font-black tabular-nums mb-1" style={{ color: INK }}>{value}</div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: `${INK}88` }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Invariant banner */}
      <div className="shadow-banner relative flex items-center gap-3 px-5 py-4 mb-6 rounded-xl" style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: `5px 5px 0px ${INK}` }}>
        <span style={{ width: 10, height: 10, background: ACCENT.emerald, border: `2px solid ${INK}`, flexShrink: 0 }} />
        <div className="text-[12.5px] font-bold" style={{ color: INK }}>
          <span style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>Shadow Invariant:</span>{" "}
          No promotion without a stored PROMOTE proof. This is inviolable.
        </div>
      </div>

      {/* Proof list */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl" style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: `5px 5px 0px ${INK}` }} />
          ))}
        </div>
      ) : (
        <div>
          <div className="mb-5 text-[13px] font-extrabold uppercase tracking-widest" style={{ color: `${INK}88` }}>
            {proofs.length} proof{proofs.length !== 1 ? "s" : ""}
          </div>
          <div className="flex flex-col gap-4">
            {proofs.map((proof) => {
              const isPromote = proof.verdict === "promote";
              const accentColor = isPromote ? ACCENT.emerald : ACCENT.red;
              const isExpanded = expanded.has(proof.proofId);
              return (
                <div key={proof.proofId} className="proof-card rounded-xl" style={{ background: "#fff", border: `2px solid ${INK}`, borderLeftWidth: 5, borderLeftColor: accentColor, boxShadow: `5px 5px 0px ${INK}` }}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                          <span className="text-[12px] font-mono font-bold" style={{ color: `${INK}88` }}>{proof.proofId}</span>
                          <span className={cn("inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase")}
                            style={{ color: "#fff", background: accentColor }}>
                            {isPromote
                              ? <CheckCircle className="size-2.5" />
                              : <XCircle className="size-2.5" />
                            }
                            {proof.verdict.toUpperCase()}
                          </span>
                        </div>

                        <div className="text-[11px] mb-3 font-mono font-bold" style={{ color: `${INK}66` }}>{proof.changeRef} · verified {fmtAgo(proof.verifiedAt)}</div>

                        <div className="flex items-center gap-5">
                          <div className="text-[12px] font-semibold">
                            <span style={{ color: `${INK}77` }}>Replayed </span>
                            <span className="font-extrabold tabular-nums" style={{ color: INK }}>{proof.replayedCases}</span>
                            <span style={{ color: `${INK}77` }}> cases</span>
                          </div>
                          <div className="text-[12px] font-semibold">
                            <span style={{ color: `${INK}77` }}>Fix </span>
                            <span className="font-extrabold" style={{ color: proof.intendedFixPassed ? ACCENT.emerald : ACCENT.red }}>
                              {proof.intendedFixPassed ? "passed" : "failed"}
                            </span>
                          </div>
                          <div className="text-[12px] font-semibold">
                            <span style={{ color: `${INK}77` }}>Regressions </span>
                            <span className="font-extrabold tabular-nums" style={{ color: proof.regressions > 0 ? ACCENT.red : ACCENT.emerald }}>
                              {proof.regressions}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button onClick={() => setExpanded((p) => { const n = new Set(p); void (n.has(proof.proofId) ? n.delete(proof.proofId) : n.add(proof.proofId)); return n; })}
                        className="memphis-press p-1.5 cursor-pointer shrink-0 rounded-md"
                        style={{ background: "#fff", border: `2px solid ${INK}`, color: INK }}>
                        {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* JSON detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                        <div className="px-5 pb-5" style={{ borderTop: `2px dashed ${INK}22` }}>
                          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] mt-4 mb-3" style={{ color: `${INK}66` }}>Proof Record</div>
                          <div className="p-4 font-mono text-[11px] leading-relaxed rounded-md"
                            style={{ background: INK, color: "#fff" }}>
                            {[
                              ["proofId",           proof.proofId,                "#bbbbbb"],
                              ["changeRef",         proof.changeRef,              "#bbbbbb"],
                              ["replayedCases",     String(proof.replayedCases),  "#bbbbbb"],
                              ["intendedFixPassed", String(proof.intendedFixPassed), proof.intendedFixPassed ? "#34d399" : "#f87171"],
                              ["regressions",       String(proof.regressions), proof.regressions > 0 ? "#f87171" : "#34d399"],
                              ["verdict",           proof.verdict.toUpperCase(),  isPromote ? "#34d399" : "#f87171"],
                            ].map(([key, val, valColor]) => (
                              <div key={key} className="flex gap-3 mb-1 last:mb-0">
                                <span className="shrink-0" style={{ color: "#777" }}>{key}:</span>
                                <span style={{ color: valColor }}>{val}</span>
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

      <div className="-mx-6">
        <StandardCard />
      </div>
    </div>
  );
}
