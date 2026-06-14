"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { motion, AnimatePresence } from "motion/react";
import { Shield, AlertTriangle, Activity, Cpu, Zap, Wifi, WifiOff } from "lucide-react";
import { HandWrittenTitle } from "@/components/ui/hand-writing-text";
import { cn } from "@/lib/utils";

interface StreamEvent {
  type: string;
  ts: string;
  message: string;
  detail?: string;
}

const EVENT_MAP: Record<string, { color: string; bg: string; label: string; Icon: React.ElementType }> = {
  vuln_detected:      { color: "#ef4444", bg: "rgba(239,68,68,0.08)",   label: "VULN",      Icon: Shield },
  vuln_healed:        { color: "#22c55e", bg: "rgba(34,197,94,0.08)",   label: "HEALED",    Icon: Shield },
  incident_open:      { color: "#f97316", bg: "rgba(249,115,22,0.08)",  label: "INCIDENT",  Icon: AlertTriangle },
  incident_resolved:  { color: "#22c55e", bg: "rgba(34,197,94,0.08)",   label: "RESOLVED",  Icon: Activity },
  antibody_minted:    { color: "#a78bfa", bg: "rgba(167,139,250,0.08)", label: "ANTIBODY",  Icon: Cpu },
  entropy_measured:   { color: "#38bdf8", bg: "rgba(56,189,248,0.08)",  label: "ENTROPY",   Icon: Zap },
};

const FILTERS = ["All", "Security", "Incidents", "Genome", "Metabolism"] as const;
type Filter = (typeof FILTERS)[number];

function matchFilter(ev: StreamEvent, f: Filter): boolean {
  if (f === "All") return true;
  if (f === "Security") return ev.type.startsWith("vuln");
  if (f === "Incidents") return ev.type.startsWith("incident");
  if (f === "Genome") return ev.type.startsWith("genome") || ev.type.startsWith("drift");
  if (f === "Metabolism") return ev.type.startsWith("entropy");
  return true;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function LogsPage() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [connected, setConnected] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const didAnimate = useRef(false);

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/stream");
      es.onopen = () => setConnected(true);
      es.onerror = () => setConnected(false);
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data as string) as StreamEvent;
          if (ev.type === "heartbeat") return;
          setEvents((prev) => [ev, ...prev].slice(0, 200));
        } catch { /* ignore */ }
      };
    } catch { /* SSE not available */ }
    return () => es?.close();
  }, []);

  // GSAP entrance — only once on mount
  useEffect(() => {
    if (didAnimate.current) return;
    didAnimate.current = true;
    const ctx = gsap.context(() => {
      gsap.from(".log-filter-pill", {
        opacity: 0, y: 8, duration: 0.35, stagger: 0.05, ease: "power2.out", delay: 0.15,
      });
      gsap.from(".log-stat", {
        opacity: 0, scale: 0.92, duration: 0.35, stagger: 0.06, ease: "back.out(1.5)", delay: 0.2,
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const filtered = events.filter((ev) => matchFilter(ev, filter)).slice(0, 50);

  const counts = {
    security: events.filter((e) => e.type.startsWith("vuln")).length,
    incidents: events.filter((e) => e.type.startsWith("incident")).length,
    antibodies: events.filter((e) => e.type === "antibody_minted").length,
    entropy: events.filter((e) => e.type === "entropy_measured").length,
  };

  return (
    <div ref={rootRef} className="max-w-5xl mx-auto px-6 pb-16 pt-2">
      <HandWrittenTitle
        title="Live Activity Stream"
        subtitle="Events stream in as HELIX acts — every vulnerability, incident, antibody, and entropy measurement."
        color="#22c55e"
      />

      {/* Connection status + event count */}
      <div className="flex items-center gap-3 -mt-4 mb-6">
        {connected ? (
          <>
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <Wifi className="size-3.5 text-emerald-500" />
          </>
        ) : (
          <WifiOff className="size-3.5 text-white/20" />
        )}
        <span className="text-[12px] text-white/35 font-mono">
          {events.length} event{events.length !== 1 ? "s" : ""} captured · showing {filtered.length}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border"
          style={{ color: "#22c55e", borderColor: "rgba(34,197,94,0.2)", background: "rgba(34,197,94,0.07)" }}>
          SSE
        </span>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Security", value: counts.security, color: "#ef4444" },
          { label: "Incidents", value: counts.incidents, color: "#f97316" },
          { label: "Antibodies", value: counts.antibodies, color: "#a78bfa" },
          { label: "Entropy", value: counts.entropy, color: "#38bdf8" },
        ].map(({ label, value, color }) => (
          <div key={label} className="log-stat rounded-xl px-4 py-3 border"
            style={{ background: "rgba(14,14,18,0.8)", borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "log-filter-pill relative px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 border cursor-pointer",
              filter === f
                ? "text-white border-white/20 bg-white/10"
                : "text-white/30 border-transparent hover:text-white/60 hover:border-white/10"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Log stream */}
      <div className="flex flex-col gap-1.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 rounded-2xl border"
              style={{ background: "rgba(14,14,18,0.6)", borderColor: "rgba(255,255,255,0.05)" }}
            >
              <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center mb-4">
                <Activity className="size-5 text-white/20" />
              </div>
              <div className="text-[13px] text-white/30 mb-1">Waiting for reflex arcs…</div>
              <div className="text-[11px] text-white/15">Events will stream in as HELIX acts.</div>
            </motion.div>
          ) : (
            filtered.map((ev, i) => {
              const cfg = EVENT_MAP[ev.type];
              const color = cfg?.color ?? "#475569";
              const bg = cfg?.bg ?? "rgba(71,85,105,0.08)";
              const label = cfg?.label ?? ev.type.replace(/_/g, " ").toUpperCase();
              const Icon = cfg?.Icon ?? Activity;
              return (
                <motion.div
                  key={`${ev.ts}-${i}`}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl border group hover:border-white/10 transition-colors duration-200"
                  style={{
                    background: "rgba(14,14,18,0.7)",
                    borderColor: "rgba(255,255,255,0.05)",
                    borderLeft: `2px solid ${color}`,
                  }}
                >
                  {/* Icon */}
                  <div className="shrink-0 mt-0.5 w-6 h-6 rounded-md flex items-center justify-center" style={{ background: bg }}>
                    <Icon className="size-3.5" style={{ color }} />
                  </div>

                  {/* Time */}
                  <div className="shrink-0 text-[11px] font-mono text-white/25 pt-0.5 w-20 tabular-nums">
                    {fmt(ev.ts)}
                  </div>

                  {/* Message */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-white/80 leading-snug">{ev.message}</div>
                    {ev.detail && (
                      <div className="text-[11px] font-mono text-white/30 mt-1 truncate">{ev.detail}</div>
                    )}
                  </div>

                  {/* Badge */}
                  <div
                    className="shrink-0 text-[9px] font-bold tracking-widest px-2 py-0.5 rounded"
                    style={{ color, background: bg, border: `1px solid ${color}20` }}
                  >
                    {label}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
