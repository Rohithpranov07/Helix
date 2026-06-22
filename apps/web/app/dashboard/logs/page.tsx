"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { motion, AnimatePresence } from "motion/react";
import { Shield, AlertTriangle, Activity, Cpu, Zap, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Features } from "@/components/ui/features-8";

// Neo-Brutalism palette — flat saturated accents on white, plus the one true ink.
const NEO = { yellow: "#ffe600", blue: "#2f5ef5", pink: "#ff3ea5", green: "#3ddc84", ink: "#0a0a0a" };

// ── Background decoration — flat icon badges drawn from this page's own domain:
// vulnerabilities/incidents/antibodies/entropy events streaming through. Zero gradient, ink outline only.
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

interface StreamEvent {
  type: string;
  ts: string;
  message: string;
  detail?: string;
}

const EVENT_MAP: Record<string, { color: string; label: string; Icon: React.ElementType }> = {
  vuln_detected:      { color: NEO.pink,   label: "VULN",      Icon: Shield },
  vuln_healed:        { color: NEO.green,  label: "HEALED",    Icon: Shield },
  incident_open:      { color: NEO.yellow, label: "INCIDENT",  Icon: AlertTriangle },
  incident_resolved:  { color: NEO.green,  label: "RESOLVED",  Icon: Activity },
  antibody_minted:    { color: NEO.blue,   label: "ANTIBODY",  Icon: Cpu },
  entropy_measured:   { color: NEO.blue,   label: "ENTROPY",   Icon: Zap },
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
    <div ref={rootRef} className="max-w-5xl mx-auto px-6 pb-16 relative" style={{ paddingTop: 104, background: "#f1e6cf" }}>
      {/* Ambient page background — warm beige canvas, a faint grid, and scattered flat icon badges */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden", background: "#f1e6cf" }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(${NEO.ink}0d 1px, transparent 1px), linear-gradient(90deg, ${NEO.ink}0d 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        <BgBadge Icon={Shield} color={NEO.pink} size={60} style={{ top: "6%", left: "4%", transform: "rotate(-10deg)", opacity: 0.45 }} />
        <BgOutlineIcon Icon={Activity} size={90} style={{ top: "16%", right: "6%", opacity: 0.22 }} />
        <BgBadge Icon={Cpu} color={NEO.blue} size={42} style={{ top: "50%", left: "2%", transform: "rotate(8deg)", opacity: 0.4 }} />
        <BgBadge Icon={AlertTriangle} color={NEO.yellow} size={38} style={{ top: "62%", right: "10%", transform: "rotate(14deg)", opacity: 0.35 }} />
        <BgOutlineIcon Icon={Zap} size={54} style={{ bottom: "18%", left: "8%", opacity: 0.25 }} />
        <BgBadge Icon={Shield} color={NEO.green} size={54} style={{ bottom: "8%", right: "5%", transform: "rotate(-6deg)", opacity: 0.4 }} />
      </div>

      {/* Header — raw chunky type, no gradients, no italics */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
        className="flex flex-col items-center text-center relative pb-2 mb-8"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.12, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="neo-card mb-6 inline-flex items-center gap-2 px-4 py-1.5"
          style={{ background: NEO.green }}
        >
          <span style={{ width: 8, height: 8, background: NEO.ink, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: NEO.ink, textTransform: "uppercase" }}>
            Live Activity Stream
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          style={{ fontSize: "clamp(2.2rem, 5.6vw, 4rem)", lineHeight: 1, letterSpacing: "-0.03em", margin: 0, fontWeight: 900, color: NEO.ink, textTransform: "uppercase" }}
        >
          Activity Stream
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="mt-4 max-w-md text-[14px] leading-relaxed font-bold"
          style={{ color: `${NEO.ink}99`, textWrap: "balance" as React.CSSProperties["textWrap"] }}
        >
          Events stream in as HELIX acts — every vulnerability, incident, antibody, and entropy measurement.
        </motion.p>
      </motion.div>

      {/* Connection status + event count */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="neo-card flex items-center gap-2 px-3 py-1.5" style={{ background: connected ? NEO.green : "#fff" }}>
          {connected ? <Wifi className="size-3.5" style={{ color: NEO.ink }} /> : <WifiOff className="size-3.5" style={{ color: NEO.ink }} />}
          <span style={{ fontSize: 11, fontWeight: 800, color: NEO.ink, textTransform: "uppercase" }}>{connected ? "Connected" : "Offline"}</span>
        </div>
        <span className="text-[12px] font-bold font-mono" style={{ color: `${NEO.ink}aa` }}>
          {events.length} event{events.length !== 1 ? "s" : ""} captured · showing {filtered.length}
        </span>
        <span className="neo-card text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1" style={{ color: NEO.ink, background: NEO.yellow }}>
          SSE
        </span>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Security", value: counts.security, color: NEO.pink },
          { label: "Incidents", value: counts.incidents, color: NEO.yellow },
          { label: "Antibodies", value: counts.antibodies, color: NEO.blue },
          { label: "Entropy", value: counts.entropy, color: NEO.green },
        ].map(({ label, value, color }) => (
          <div key={label} className="log-stat neo-card px-4 py-3">
            <div className="text-[10px] font-extrabold uppercase tracking-widest mb-1.5" style={{ color: `${NEO.ink}88` }}>{label}</div>
            <div className="flex items-center gap-2">
              <span style={{ width: 10, height: 10, background: color, border: `2px solid ${NEO.ink}`, flexShrink: 0 }} />
              <div className="text-2xl font-black tabular-nums" style={{ color: NEO.ink }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter pills — chunky toggle buttons, selected = pressed flat */}
      <div className="flex items-center gap-2.5 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "log-filter-pill px-4 py-1.5 text-[12px] font-extrabold uppercase cursor-pointer border-[3px]",
              filter === f ? "" : "neo-press"
            )}
            style={{
              borderColor: NEO.ink,
              borderRadius: 6,
              background: filter === f ? NEO.ink : "#fff",
              color: filter === f ? "#fff" : NEO.ink,
              boxShadow: filter === f ? "none" : "4px 4px 0px #0a0a0a",
              transform: filter === f ? "translate(2px, 2px)" : "none",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Log stream */}
      <div className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="neo-card flex flex-col items-center justify-center py-20"
            >
              <div className="w-12 h-12 flex items-center justify-center mb-4" style={{ background: NEO.yellow, border: `3px solid ${NEO.ink}` }}>
                <Activity className="size-5" style={{ color: NEO.ink }} />
              </div>
              <div className="text-[14px] font-extrabold mb-1" style={{ color: NEO.ink }}>Waiting for reflex arcs…</div>
              <div className="text-[12px] font-bold" style={{ color: `${NEO.ink}66` }}>Events will stream in as HELIX acts.</div>
            </motion.div>
          ) : (
            filtered.map((ev, i) => {
              const cfg = EVENT_MAP[ev.type];
              const color = cfg?.color ?? "#9a9a9a";
              const label = cfg?.label ?? ev.type.replace(/_/g, " ").toUpperCase();
              const Icon = cfg?.Icon ?? Activity;
              return (
                <motion.div
                  key={`${ev.ts}-${i}`}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ x: -2, y: -2 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="neo-card flex items-start gap-3 px-4 py-3"
                  style={{ borderLeftWidth: 6, borderLeftColor: color, boxShadow: "4px 4px 0px #0a0a0a" }}
                >
                  {/* Icon */}
                  <div className="shrink-0 mt-0.5 w-7 h-7 flex items-center justify-center" style={{ background: color, border: `2px solid ${NEO.ink}` }}>
                    <Icon className="size-3.5" style={{ color: NEO.ink }} />
                  </div>

                  {/* Time */}
                  <div className="shrink-0 text-[11px] font-mono font-bold pt-0.5 w-20 tabular-nums" style={{ color: `${NEO.ink}66` }}>
                    {fmt(ev.ts)}
                  </div>

                  {/* Message */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold leading-snug" style={{ color: NEO.ink }}>{ev.message}</div>
                    {ev.detail && (
                      <div className="text-[11px] font-mono font-bold mt-1 truncate" style={{ color: `${NEO.ink}55` }}>{ev.detail}</div>
                    )}
                  </div>

                  {/* Badge */}
                  <div
                    className="shrink-0 text-[9px] font-extrabold tracking-widest px-2 py-0.5"
                    style={{ color: NEO.ink, background: color, border: `2px solid ${NEO.ink}` }}
                  >
                    {label}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <div className="-mx-6">
        <Features />
      </div>
    </div>
  );
}
