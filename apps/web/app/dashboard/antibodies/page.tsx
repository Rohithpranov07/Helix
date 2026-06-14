"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { motion, AnimatePresence } from "motion/react";
import { Search, ChevronDown, ChevronUp, Shield, Zap, Cpu, X } from "lucide-react";
import { HandWrittenTitle } from "@/components/ui/hand-writing-text";
import { cn } from "@/lib/utils";

interface Antibody {
  antibodyId: string;
  signature: string;
  sourceType: "vuln" | "incident";
  regressionTest?: string;
  runtimeAssertion?: string;
  recurrencesBlocked: number;
  mintedAt: string;
}

function fmtAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const DEMO_ANTIBODIES: Antibody[] = [
  { antibodyId: "ab-47", signature: "SQL injection via unescaped user input at /api/search?q= parameter", sourceType: "vuln", recurrencesBlocked: 2, mintedAt: new Date(Date.now() - 60000).toISOString(), regressionTest: "expect(response.status).toBe(400) // on ' OR '1'='1", runtimeAssertion: "assert !query.includes('OR') || isParameterized(query)" },
  { antibodyId: "ab-46", signature: "Null reference exception in checkout handler when cart is empty",    sourceType: "incident", recurrencesBlocked: 1, mintedAt: new Date(Date.now() - 7200000).toISOString(), regressionTest: "expect(checkout({ items: [] })).not.toThrow()", runtimeAssertion: "assert cart !== null && cart.items !== undefined" },
  { antibodyId: "ab-45", signature: "XSS via unsanitized HTML in comment field",                          sourceType: "vuln", recurrencesBlocked: 0, mintedAt: new Date(Date.now() - 86400000).toISOString(), regressionTest: "expect(sanitize('<script>alert(1)</script>')).not.toContain('<script>')", runtimeAssertion: "assert DOMPurify.sanitize(input) === input" },
  { antibodyId: "ab-44", signature: "Auth bypass on admin routes via missing middleware guard",            sourceType: "vuln", recurrencesBlocked: 0, mintedAt: new Date(Date.now() - 172800000).toISOString() },
  { antibodyId: "ab-43", signature: "Missing RLS policy on user_data table allowing cross-tenant reads",  sourceType: "vuln", recurrencesBlocked: 0, mintedAt: new Date(Date.now() - 259200000).toISOString() },
];

const SOURCE_CONFIG = {
  vuln:     { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.2)",  label: "VULN",     Icon: Shield },
  incident: { color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.2)", label: "INCIDENT", Icon: Zap },
};

export default function AntibodiesPage() {
  const [antibodies, setAntibodies] = useState<Antibody[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const counterRefs = useRef<{ [key: string]: HTMLSpanElement | null }>({});
  const didAnimate = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/antibodies");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { antibodies?: Antibody[]; error?: string };
        if (json.error) throw new Error(json.error);
        if (json.antibodies && json.antibodies.length > 0) {
          setAntibodies(json.antibodies);
        } else {
          setAntibodies(DEMO_ANTIBODIES);
          setDemoMode(true);
        }
      } catch {
        setAntibodies(DEMO_ANTIBODIES);
        setDemoMode(true);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  // GSAP entrance + number counter
  useEffect(() => {
    if (loading || didAnimate.current) return;
    didAnimate.current = true;
    const ctx = gsap.context(() => {

      gsap.from(".ab-hero", { opacity: 0, y: 16, scale: 0.97, duration: 0.5, ease: "back.out(1.3)", delay: 0.1 });
      gsap.from(".ab-stat", { opacity: 0, y: 16, scale: 0.94, duration: 0.4, stagger: 0.07, ease: "back.out(1.4)", delay: 0.2 });
      gsap.from(".ab-search", { opacity: 0, y: 10, duration: 0.35, ease: "power2.out", delay: 0.32 });
      gsap.from(".ab-card", { opacity: 0, y: 18, duration: 0.4, stagger: 0.07, ease: "power2.out", delay: 0.38 });

      // Number counter for total antibodies
      const totalEl = counterRefs.current["total"];
      if (totalEl) {
        const obj = { val: 0 };
        gsap.to(obj, {
          val: antibodies.length,
          duration: 0.9,
          delay: 0.2,
          ease: "power2.out",
          onUpdate: () => { totalEl.textContent = String(Math.round(obj.val)); },
        });
      }
    }, rootRef);
    return () => ctx.revert();
  }, [loading, antibodies.length]);

  const totalBlocked = antibodies.reduce((a, b) => a + b.recurrencesBlocked, 0);
  const filtered = searchQuery
    ? antibodies.filter((a) =>
        a.signature.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.antibodyId.includes(searchQuery)
      )
    : antibodies;

  return (
    <div ref={rootRef} className="max-w-5xl mx-auto px-6 pb-16 pt-2">
      <HandWrittenTitle
        title="Antibody Library"
        subtitle="Every one of these is a threat that can never land again. Permanently encoded as regression tests and runtime assertions."
        color="#a78bfa"
      />

      {/* Demo notice */}
      {demoMode && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border text-[12px] mb-5"
          style={{ background: "rgba(234,179,8,0.06)", borderColor: "rgba(234,179,8,0.18)", color: "#d97706" }}>
          <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5 shrink-0"><path d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6a1 1 0 110 2 1 1 0 010-2z"/></svg>
          Showing demo antibody data — live data requires MongoDB.
        </div>
      )}

      {/* Hero counts */}
      <div className="ab-hero rounded-2xl border p-6 mb-5 overflow-hidden relative"
        style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.07) 0%, rgba(34,197,94,0.04) 100%)", borderColor: "rgba(167,139,250,0.15)" }}>
        {/* Subtle glow */}
        <div className="absolute top-0 left-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)", transform: "translate(-30%, -30%)" }} />
        <div className="relative flex items-center gap-8 flex-wrap">
          <div>
            <div className="text-[64px] font-black leading-none tabular-nums" style={{ color: "#a78bfa" }}>
              <span ref={(el) => { counterRefs.current["total"] = el; }}>
                {antibodies.length}
              </span>
            </div>
            <div className="text-[13px] text-white/40 mt-1">antibodies minted</div>
          </div>
          <div className="w-px h-14 bg-white/[0.08]" />
          <div>
            <div className="text-[40px] font-black leading-none tabular-nums text-emerald-400">{totalBlocked}</div>
            <div className="text-[13px] text-white/40 mt-1">recurrences blocked</div>
          </div>
          <div className="ml-auto text-[12px] text-white/25 max-w-[220px] leading-relaxed hidden md:block">
            768-dim vectors indexed in Atlas Vector Search. Semantic recall across all known threats.
          </div>
        </div>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "From Vulnerabilities", value: antibodies.filter((a) => a.sourceType === "vuln").length,     color: "#ef4444", Icon: Shield },
          { label: "From Incidents",       value: antibodies.filter((a) => a.sourceType === "incident").length, color: "#f97316", Icon: Zap },
          { label: "Recurrences Blocked",  value: totalBlocked,                                                  color: "#22c55e", Icon: Cpu },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="ab-stat rounded-xl p-4 border" style={{ background: "rgba(14,14,18,0.8)", borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">{label}</div>
              <Icon className="size-3.5" style={{ color, opacity: 0.55 }} />
            </div>
            <div className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="ab-search rounded-2xl border p-4 mb-5" style={{ background: "rgba(14,14,18,0.8)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/25 mb-3">Immune Memory Search</div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-white/25 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search threat signatures… e.g. 'SQL injection' or 'checkout null'"
            className="w-full rounded-xl border bg-transparent text-[13px] text-white/80 pl-10 pr-10 py-2.5 placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors duration-200"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="mt-2 text-[11px] text-white/30">
            {filtered.length} match{filtered.length !== 1 ? "es" : ""} for &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>

      {/* Antibody cards */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border h-20 animate-pulse" style={{ background: "rgba(14,14,18,0.5)", borderColor: "rgba(255,255,255,0.05)" }} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <AnimatePresence>
            {filtered.map((ab) => {
              const sc = SOURCE_CONFIG[ab.sourceType];
              const SrcIcon = sc.Icon;
              const isExpanded = expanded.has(ab.antibodyId);
              const hasDetail = !!(ab.regressionTest ?? ab.runtimeAssertion);
              return (
                <div key={ab.antibodyId} className="ab-card rounded-2xl border overflow-hidden"
                  style={{ background: "rgba(14,14,18,0.8)", borderColor: "rgba(255,255,255,0.06)", borderLeft: `3px solid ${sc.color}` }}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* ID row */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[11px] font-mono font-bold" style={{ color: "#a78bfa" }}>{ab.antibodyId}</span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded"
                            style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>
                            <SrcIcon className="size-2.5" />
                            {sc.label}
                          </span>
                          {ab.recurrencesBlocked > 0 && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded text-emerald-400"
                              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
                              {ab.recurrencesBlocked} blocked
                            </span>
                          )}
                        </div>

                        {/* Signature */}
                        <div className="text-[13px] text-white/75 leading-snug mb-2">{ab.signature}</div>
                        <div className="text-[11px] text-white/25 font-mono">Minted {fmtAgo(ab.mintedAt)}</div>
                      </div>

                      {hasDetail && (
                        <button onClick={() => setExpanded((p) => { const n = new Set(p); n.has(ab.antibodyId) ? n.delete(ab.antibodyId) : n.add(ab.antibodyId); return n; })}
                          className="p-1.5 rounded-lg transition-all duration-200 cursor-pointer shrink-0"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                          {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Detail panel */}
                  <AnimatePresence>
                    {isExpanded && hasDetail && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                        <div className="px-5 pb-5 border-t flex flex-col gap-4" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                          {ab.regressionTest && (
                            <div className="mt-4">
                              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/25 mb-2">Regression Test</div>
                              <pre className="text-[11px] font-mono leading-relaxed rounded-xl p-4 overflow-x-auto text-emerald-300/80"
                                style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }}>
                                {ab.regressionTest}
                              </pre>
                            </div>
                          )}
                          {ab.runtimeAssertion && (
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/25 mb-2">Runtime Assertion</div>
                              <pre className="text-[11px] font-mono leading-relaxed rounded-xl p-4 overflow-x-auto text-blue-300/80"
                                style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)" }}>
                                {ab.runtimeAssertion}
                              </pre>
                            </div>
                          )}
                          <div className="text-[10px] font-mono text-white/20">
                            embedding: 768-dim vector · Atlas Vector Search indexed
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && searchQuery && (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border"
              style={{ background: "rgba(14,14,18,0.6)", borderColor: "rgba(255,255,255,0.05)" }}>
              <Search className="size-8 text-white/10 mb-3" />
              <div className="text-[13px] text-white/30">No antibodies matching &ldquo;{searchQuery}&rdquo;</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
