"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { motion, AnimatePresence } from "motion/react";
import { Lock, ChevronDown, ChevronUp, CheckCircle, XCircle, BarChart3, Shield } from "lucide-react";
import { HandWrittenTitle } from "@/components/ui/hand-writing-text";
import { cn } from "@/lib/utils";

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const didAnimate = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/vitals");
        if (!res.ok) throw new Error("not ok");
        const json = await res.json() as { snapshot?: { recentShadowProofs?: ShadowProof[] } };
        const proofList = json.snapshot?.recentShadowProofs;
        if (proofList && proofList.length > 0) {
          setProofs(proofList);
        } else {
          setProofs(DEMO_PROOFS);
          setDemoMode(true);
        }
      } catch {
        setProofs(DEMO_PROOFS);
        setDemoMode(true);
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
    <div ref={rootRef} className="max-w-5xl mx-auto px-6 pb-16 pt-2">
      <HandWrittenTitle
        title="Shadow Proofs"
        subtitle="Every code change verified in Shadow before promotion. No patch reaches production without a stored PROMOTE proof."
        color="#818cf8"
      />

      {/* Demo notice */}
      {demoMode && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border text-[12px] mb-5"
          style={{ background: "rgba(234,179,8,0.06)", borderColor: "rgba(234,179,8,0.18)", color: "#d97706" }}>
          <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5 shrink-0"><path d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6a1 1 0 110 2 1 1 0 010-2z"/></svg>
          Showing demo proof data — live data requires MongoDB.
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Proofs",   value: proofs.length, color: "#f1f5f9", Icon: BarChart3 },
          { label: "Promoted",       value: promoted,      color: "#22c55e", Icon: CheckCircle },
          { label: "Rejected",       value: rejected,      color: rejected > 0 ? "#ef4444" : "#334155", Icon: XCircle },
          { label: "Pass Rate",      value: passRate !== null ? `${passRate}%` : "—", color: "#818cf8", Icon: Shield },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="shadow-stat rounded-xl p-4 border" style={{ background: "rgba(14,14,18,0.8)", borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">{label}</div>
              <Icon className="size-3.5" style={{ color, opacity: 0.55 }} />
            </div>
            <div className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Invariant banner */}
      <div className="shadow-banner flex items-center gap-3 px-5 py-4 rounded-xl border mb-6"
        style={{ background: "rgba(129,140,248,0.06)", borderColor: "rgba(129,140,248,0.18)" }}>
        <Lock className="size-4 shrink-0 text-indigo-400" />
        <div className="text-[12.5px] text-indigo-300/80">
          <strong className="text-indigo-300">Shadow Invariant:</strong> No promotion without a stored PROMOTE proof. This is inviolable.
        </div>
      </div>

      {/* Proof list */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border h-24 animate-pulse" style={{ background: "rgba(14,14,18,0.5)", borderColor: "rgba(255,255,255,0.05)" }} />
          ))}
        </div>
      ) : (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-4">
            {proofs.length} proof{proofs.length !== 1 ? "s" : ""}
          </div>
          <div className="flex flex-col gap-3">
            {proofs.map((proof) => {
              const isPromote = proof.verdict === "promote";
              const accentColor = isPromote ? "#22c55e" : "#ef4444";
              const isExpanded = expanded.has(proof.proofId);
              return (
                <div key={proof.proofId} className="proof-card rounded-2xl border overflow-hidden"
                  style={{ background: "rgba(14,14,18,0.8)", borderColor: "rgba(255,255,255,0.06)", borderLeft: `3px solid ${accentColor}` }}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Proof ID + verdict */}
                        <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                          <span className="text-[12px] font-mono text-white/50">{proof.proofId}</span>
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
                            isPromote
                              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
                              : "text-red-400 bg-red-500/10 border-red-500/25"
                          )}>
                            {isPromote
                              ? <CheckCircle className="size-2.5" />
                              : <XCircle className="size-2.5" />
                            }
                            {proof.verdict.toUpperCase()}
                          </span>
                        </div>

                        <div className="text-[11px] text-white/35 mb-3 font-mono">{proof.changeRef} · verified {fmtAgo(proof.verifiedAt)}</div>

                        {/* Metrics row */}
                        <div className="flex items-center gap-5">
                          <div className="text-[12px]">
                            <span className="text-white/30">Replayed </span>
                            <span className="text-white/70 font-semibold tabular-nums">{proof.replayedCases}</span>
                            <span className="text-white/30"> cases</span>
                          </div>
                          <div className="text-[12px]">
                            <span className="text-white/30">Fix </span>
                            <span className={cn("font-semibold", proof.intendedFixPassed ? "text-emerald-400" : "text-red-400")}>
                              {proof.intendedFixPassed ? "passed" : "failed"}
                            </span>
                          </div>
                          <div className="text-[12px]">
                            <span className="text-white/30">Regressions </span>
                            <span className={cn("font-semibold tabular-nums", proof.regressions > 0 ? "text-red-400" : "text-emerald-400")}>
                              {proof.regressions}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button onClick={() => setExpanded((p) => { const n = new Set(p); n.has(proof.proofId) ? n.delete(proof.proofId) : n.add(proof.proofId); return n; })}
                        className="p-1.5 rounded-lg transition-all duration-200 cursor-pointer shrink-0"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                        {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* JSON detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                        <div className="px-5 pb-5 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/25 mt-4 mb-3">Proof Record</div>
                          <div className="rounded-xl p-4 font-mono text-[11px] leading-relaxed"
                            style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
                            {[
                              ["proofId",           proof.proofId,                "#94a3b8"],
                              ["changeRef",         proof.changeRef,              "#94a3b8"],
                              ["replayedCases",     String(proof.replayedCases),  "#94a3b8"],
                              ["intendedFixPassed", String(proof.intendedFixPassed), proof.intendedFixPassed ? "#22c55e" : "#ef4444"],
                              ["regressions",       String(proof.regressions), proof.regressions > 0 ? "#ef4444" : "#22c55e"],
                              ["verdict",           proof.verdict.toUpperCase(),  isPromote ? "#22c55e" : "#ef4444"],
                            ].map(([key, val, valColor]) => (
                              <div key={key} className="flex gap-3 mb-1 last:mb-0">
                                <span className="text-white/30 shrink-0">{key}:</span>
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
    </div>
  );
}
