"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { motion, AnimatePresence } from "motion/react";
import { Search, ChevronDown, ChevronUp, Shield, Zap, Cpu, X } from "lucide-react";
import { Component as RecognizedSignatures } from "@/components/ui/vercep-feature-1";

// Mid-Century Modern palette — warm Atomic Age earth tones, used consistently everywhere.
const ATOMIC = { cream: "#f3e8d0", mustard: "#e3a23c", terracotta: "#cc6b49", teal: "#3f7a72", walnut: "#3a2e26", rust: "#b5482f" };

function Starburst({ color, size = 60, rays = 12 }: { color: string; size?: number; rays?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden style={{ flexShrink: 0 }}>
      {Array.from({ length: rays }).map((_, i) => (
        <rect key={i} x="48.5" y="4" width="3" height="46" rx="1.5" fill={color}
          transform={`rotate(${(360 / rays) * i} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="7" fill={color} />
    </svg>
  );
}

function Boomerang({ color, style }: { color: string; style?: React.CSSProperties }) {
  return (
    <svg width="120" height="70" viewBox="0 0 120 70" aria-hidden style={{ position: "absolute", pointerEvents: "none", ...style }}>
      <path d="M4 60 C 10 20, 40 4, 62 10 C 50 16, 40 28, 42 40 C 60 30, 84 28, 110 44 C 86 36, 64 42, 56 56 C 48 66, 22 68, 4 60 Z" fill={color} />
    </svg>
  );
}

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
  vuln:     { color: ATOMIC.rust,    label: "VULN",     Icon: Shield },
  incident: { color: ATOMIC.mustard, label: "INCIDENT", Icon: Zap },
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
    <div ref={rootRef} className="max-w-5xl mx-auto px-6 pb-16 relative" style={{ paddingTop: 104, background: ATOMIC.cream }}>
      {/* Ambient page background — cream canvas with a faint sunburst and boomerang motifs */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden", background: ATOMIC.cream }}>
        <div style={{ position: "absolute", top: "-8%", left: "50%", transform: "translateX(-50%)", opacity: 0.5 }}>
          <Starburst color={`${ATOMIC.mustard}33`} size={420} rays={16} />
        </div>
        <Boomerang color={`${ATOMIC.teal}22`} style={{ top: "22%", left: "-3%", transform: "rotate(8deg) scale(1.3)" }} />
        <Boomerang color={`${ATOMIC.terracotta}22`} style={{ bottom: "8%", right: "-2%", transform: "rotate(-14deg) scale(1.5)" }} />
      </div>

      {/* Header — mid-century editorial: walnut ink type, mustard pill eyebrow, starburst accent */}
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
          className="mb-6 inline-flex items-center gap-2.5 px-4 py-2 rounded-full"
          style={{ background: ATOMIC.mustard, color: "#fff" }}
        >
          <Cpu className="size-3.5" />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Immune Memory
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="flex items-center gap-4"
        >
          <Starburst color={ATOMIC.terracotta} size={44} />
          <h1 style={{ fontSize: "clamp(2.2rem, 5.6vw, 4rem)", lineHeight: 1.02, letterSpacing: "-0.02em", margin: 0, fontWeight: 800, color: ATOMIC.walnut }}>
            Antibody Library
          </h1>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="mt-5 max-w-md text-[14px] leading-relaxed font-semibold"
          style={{ color: `${ATOMIC.walnut}99`, textWrap: "balance" as React.CSSProperties["textWrap"] }}
        >
          Every one of these is a threat that can never land again. Permanently encoded as regression tests and runtime assertions.
        </motion.p>
      </motion.div>

      {/* Demo notice */}
      {demoMode && (
        <div className="atomic-card flex items-center gap-2.5 px-4 py-3 text-[12px] mb-5 font-semibold"
          style={{ color: ATOMIC.walnut, background: `${ATOMIC.mustard}22` }}>
          <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5 shrink-0"><path d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6a1 1 0 110 2 1 1 0 010-2z"/></svg>
          Showing demo antibody data — live data requires MongoDB.
        </div>
      )}

      {/* Hero counts — color-blocked teal panel, boomerang accent */}
      <div className="ab-hero atomic-card p-7 mb-5 overflow-hidden relative" style={{ background: ATOMIC.teal }}>
        <Boomerang color="rgba(255,255,255,0.07)" style={{ top: -10, right: -10, transform: "rotate(20deg) scale(1.1)" }} />
        <div className="relative flex items-center gap-8 flex-wrap">
          <div>
            <div className="text-[64px] font-black leading-none tabular-nums" style={{ color: "#fff" }}>
              <span ref={(el) => { counterRefs.current["total"] = el; }}>
                {antibodies.length}
              </span>
            </div>
            <div className="text-[13px] mt-1 font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>antibodies minted</div>
          </div>
          <div className="w-px h-14" style={{ background: "rgba(255,255,255,0.18)" }} />
          <div>
            <div className="text-[40px] font-black leading-none tabular-nums" style={{ color: ATOMIC.cream }}>{totalBlocked}</div>
            <div className="text-[13px] mt-1 font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>recurrences blocked</div>
          </div>
          <div className="ml-auto text-[12px] max-w-[220px] leading-relaxed hidden md:block font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
            768-dim vectors indexed in Atlas Vector Search. Semantic recall across all known threats.
          </div>
        </div>
      </div>

      {/* Stat chips — each its own atomic color block */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "From Vulnerabilities", value: antibodies.filter((a) => a.sourceType === "vuln").length,     color: ATOMIC.rust, Icon: Shield },
          { label: "From Incidents",       value: antibodies.filter((a) => a.sourceType === "incident").length, color: ATOMIC.mustard, Icon: Zap },
          { label: "Recurrences Blocked",  value: totalBlocked,                                                  color: ATOMIC.teal, Icon: Cpu },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="ab-stat atomic-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: `${ATOMIC.walnut}77` }}>{label}</div>
              <span className="flex items-center justify-center size-7 rounded-full" style={{ background: `${color}1f` }}>
                <Icon className="size-3.5" style={{ color }} />
              </span>
            </div>
            <div className="text-2xl font-black tabular-nums" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="ab-search atomic-card p-4 mb-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3" style={{ color: `${ATOMIC.walnut}77` }}>Immune Memory Search</div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 pointer-events-none" style={{ color: `${ATOMIC.walnut}66` }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search threat signatures… e.g. 'SQL injection' or 'checkout null'"
            className="w-full rounded-full border text-[13px] bg-transparent pl-10 pr-10 py-2.5 focus:outline-none transition-colors duration-200 font-medium"
            style={{ borderColor: `${ATOMIC.walnut}26`, color: ATOMIC.walnut }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer" style={{ color: `${ATOMIC.walnut}66` }}>
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="mt-2 text-[11px] font-semibold" style={{ color: `${ATOMIC.walnut}77` }}>
            {filtered.length} match{filtered.length !== 1 ? "es" : ""} for &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>

      {/* Antibody cards */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="atomic-card h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {filtered.map((ab) => {
              const sc = SOURCE_CONFIG[ab.sourceType];
              const SrcIcon = sc.Icon;
              const isExpanded = expanded.has(ab.antibodyId);
              const hasDetail = !!(ab.regressionTest ?? ab.runtimeAssertion);
              return (
                <div key={ab.antibodyId} className="ab-card atomic-card overflow-hidden relative" style={{ borderLeft: `5px solid ${sc.color}` }}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* ID row */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[11px] font-mono font-bold" style={{ color: ATOMIC.teal }}>{ab.antibodyId}</span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2.5 py-0.5 rounded-full"
                            style={{ color: "#fff", background: sc.color }}>
                            <SrcIcon className="size-2.5" />
                            {sc.label}
                          </span>
                          {ab.recurrencesBlocked > 0 && (
                            <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full" style={{ color: "#fff", background: ATOMIC.teal }}>
                              {ab.recurrencesBlocked} blocked
                            </span>
                          )}
                        </div>

                        {/* Signature */}
                        <div className="text-[13px] leading-snug mb-2 font-medium" style={{ color: `${ATOMIC.walnut}dd` }}>{ab.signature}</div>
                        <div className="text-[11px] font-mono font-semibold" style={{ color: `${ATOMIC.walnut}55` }}>Minted {fmtAgo(ab.mintedAt)}</div>
                      </div>

                      {hasDetail && (
                        <button onClick={() => setExpanded((p) => { const n = new Set(p); void (n.has(ab.antibodyId) ? n.delete(ab.antibodyId) : n.add(ab.antibodyId)); return n; })}
                          className="atomic-press p-1.5 rounded-full cursor-pointer shrink-0"
                          style={{ background: `${ATOMIC.walnut}0f`, color: `${ATOMIC.walnut}99` }}>
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
                        <div className="px-5 pb-5 flex flex-col gap-4" style={{ borderTop: `1px solid ${ATOMIC.walnut}14` }}>
                          {ab.regressionTest && (
                            <div className="mt-4">
                              <div className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: `${ATOMIC.walnut}77` }}>Regression Test</div>
                              <pre className="text-[11px] font-mono leading-relaxed rounded-2xl p-4 overflow-x-auto"
                                style={{ background: `${ATOMIC.teal}14`, color: ATOMIC.teal }}>
                                {ab.regressionTest}
                              </pre>
                            </div>
                          )}
                          {ab.runtimeAssertion && (
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: `${ATOMIC.walnut}77` }}>Runtime Assertion</div>
                              <pre className="text-[11px] font-mono leading-relaxed rounded-2xl p-4 overflow-x-auto"
                                style={{ background: `${ATOMIC.rust}14`, color: ATOMIC.rust }}>
                                {ab.runtimeAssertion}
                              </pre>
                            </div>
                          )}
                          <div className="text-[10px] font-mono font-semibold" style={{ color: `${ATOMIC.walnut}55` }}>
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
            <div className="atomic-card flex flex-col items-center justify-center py-16">
              <Starburst color={`${ATOMIC.walnut}33`} size={40} />
              <div className="text-[13px] mt-3 font-semibold" style={{ color: `${ATOMIC.walnut}88` }}>No antibodies matching &ldquo;{searchQuery}&rdquo;</div>
            </div>
          )}
        </div>
      )}

      <div className="-mx-6">
        <RecognizedSignatures />
      </div>
    </div>
  );
}
