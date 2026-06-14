"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { CinematicFooter } from "@/components/ui/motion-footer";
import { ArrowUpRight } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface VitalsData {
  entropy: { temperature: number; projectedRewriteWeeks: number } | null;
  immune: { open: number; healed: number; total: number };
  genome: { pairingPct: number | null; avgScore: number | null; totalUnpaired: number; modules: number; paired: number };
  nervous: {
    total: number;
    resolved: number;
    recent: Array<{ incidentId: string; detectedAt: string; resolved: boolean; userImpactSeconds: number }>;
  };
  memory: { antibodies: number; recurrencesBlocked: number };
  shadow: { total: number; promoted: number; rejected: number } | null;
  heartRate: { deploysPerDay: number; incidentsPerDay: number };
  metabolism: { lastTemp: number | null; projectedWeeks: number | null } | null;
}

// ── Demo fallback data ─────────────────────────────────────────────────────────

const DEMO: VitalsData = {
  entropy: { temperature: 0.62, projectedRewriteWeeks: 14 },
  immune: { open: 2, healed: 44, total: 47 },
  genome: { pairingPct: 84, avgScore: 0.84, totalUnpaired: 2, modules: 5, paired: 5 },
  nervous: {
    total: 3,
    resolved: 3,
    recent: [{ incidentId: "inc-01", detectedAt: new Date(Date.now() - 7200000).toISOString(), resolved: true, userImpactSeconds: 71 }],
  },
  memory: { antibodies: 48, recurrencesBlocked: 3 },
  shadow: { total: 12, promoted: 11, rejected: 1 },
  heartRate: { deploysPerDay: 4, incidentsPerDay: 0 },
  metabolism: { lastTemp: 0.62, projectedWeeks: 14 },
};

export default function DashboardPage() {
  const [vitals, setVitals] = useState<VitalsData | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/vitals");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { snapshot?: any };
      const s = json.snapshot ?? {};
      setVitals({
        entropy: s.entropy ?? null,
        immune: s.immune ?? DEMO.immune,
        genome: s.genome ? { ...s.genome, pairingPct: s.genome.pairingPct ?? null } : DEMO.genome,
        nervous: s.nervous ?? DEMO.nervous,
        memory: s.memory ?? DEMO.memory,
        shadow: s.shadow ?? null,
        heartRate: s.heartRate ?? DEMO.heartRate,
        metabolism: s.metabolism ?? null,
      });
      setDemoMode(false);
    } catch {
      setVitals(DEMO);
      setDemoMode(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const timelineRef = useRef<HTMLDivElement>(null);
  const revealVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        delay: i * 0.2,
        duration: 0.5,
      },
    }),
    hidden: {
      filter: "blur(10px)",
      y: -20,
      opacity: 0,
    },
  };

  const v = vitals ?? DEMO;

  if (loading && !vitals) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-400 font-medium text-sm tracking-widest uppercase">
        Loading...
      </div>
    );
  }

  const systemCards = [
    {
      name: "View Live Logs",
      url: "/dashboard/logs",
      desc: "Every reflex arc fires here in real time.",
      imgSrc: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1470&auto=format&fit=crop",
      badge: "⚡ LIVE",
      badgeColor: "bg-green-500",
    },
    {
      name: "Immune System",
      url: "/dashboard/immune",
      desc: `${v.immune.open} open · ${v.immune.healed} healed`,
      imgSrc: "https://images.unsplash.com/photo-1614064641913-a53b15c807ed?q=80&w=1374&auto=format&fit=crop",
      badge: v.immune.open === 0 ? "CLEAR" : "ACTIVE",
      badgeColor: v.immune.open === 0 ? "bg-green-500" : "bg-red-500",
    },
    {
      name: "Genome Integrity",
      url: "/dashboard/genome",
      desc: `${v.genome.pairingPct ?? v.genome.avgScore ?? '—'}% paired · ${v.genome.totalUnpaired} unpaired`,
      imgSrc: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?q=80&w=1470&auto=format&fit=crop",
      badge: v.genome.totalUnpaired > 0 ? "DRIFTED" : "PAIRED",
      badgeColor: v.genome.totalUnpaired > 0 ? "bg-yellow-500" : "bg-green-500",
    },
    {
      name: "Resurrection Reflex",
      url: "/dashboard/incidents",
      desc: `${v.nervous.resolved}/${v.nervous.total} resolved incidents`,
      imgSrc: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1470&auto=format&fit=crop",
      badge: (v.nervous.total - v.nervous.resolved) > 0 ? "INCIDENT" : "STABLE",
      badgeColor: (v.nervous.total - v.nervous.resolved) > 0 ? "bg-orange-500" : "bg-green-500",
    },
    {
      name: "Metabolism",
      url: "/dashboard/metabolism",
      desc: `Entropy: ${v.metabolism?.lastTemp != null ? Math.round(v.metabolism.lastTemp * 100) + '°' : '—'}`,
      imgSrc: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=1493&auto=format&fit=crop",
      badge: v.metabolism?.lastTemp && v.metabolism.lastTemp >= 0.7 ? "HOT" : "COOL",
      badgeColor: v.metabolism?.lastTemp && v.metabolism.lastTemp >= 0.7 ? "bg-red-500" : "bg-blue-500",
    },
    {
      name: "Antibody Library",
      url: "/dashboard/antibodies",
      desc: `${v.memory.antibodies} permanent defences minted`,
      imgSrc: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?q=80&w=1470&auto=format&fit=crop",
      badge: "ACTIVE",
      badgeColor: "bg-indigo-500",
    },
    {
      name: "Shadow Proofs",
      url: "/dashboard/shadow",
      desc: `${v.shadow?.total ?? 0} total proofs`,
      imgSrc: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1470&auto=format&fit=crop",
      badge: "ACTIVE",
      badgeColor: "bg-purple-500",
    },
  ];

  return (
    <>
      <div ref={timelineRef} className="text-slate-50">
        {/* ── Demo Banner ── */}
        {demoMode && (
          <TimelineContent
            as="div"
            animationNum={0}
            timelineRef={timelineRef}
            className="w-full bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 text-center text-xs text-yellow-700 font-medium z-50 relative"
          >
            ⚠️ MongoDB offline — showing demo data. Live data streams once connected.
          </TimelineContent>
        )}

        {/* Main Content Area */}
        <div className="pt-32 pb-12 max-w-screen-2xl mx-auto min-h-screen px-4">
          {/* Title Section */}
          <article className="w-fit mx-auto 2xl:max-w-5xl xl:max-w-4xl max-w-2xl text-center space-y-8">
            <TimelineContent
              as="div"
              animationNum={2}
              timelineRef={timelineRef}
              customVariants={revealVariants}
              className="flex w-fit mx-auto items-center gap-1 rounded-full bg-blue-600 border-4 border-blue-900/50 py-0.5 pl-0.5 pr-3 text-xs"
            >
              <div className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-900 font-bold">
                System Status
              </div>
              <p className="text-white sm:text-base text-xs inline-block ml-1">
                {v.entropy?.temperature && v.entropy.temperature < 0.5 ? "All systems healthy" : "Monitoring entropy levels"}
              </p>
            </TimelineContent>

            <TimelineContent
              as="h1"
              animationNum={3}
              timelineRef={timelineRef}
              customVariants={revealVariants}
              className="2xl:text-7xl text-white xl:text-6xl sm:text-5xl text-4xl leading-[100%] font-medium"
            >
              Real-time{" "}
              <span className="font-semibold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                Vitals
              </span>{" "}
              and{" "}
              <span className="font-semibold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Organs
              </span>
            </TimelineContent>

            <TimelineContent
              as="p"
              animationNum={4}
              timelineRef={timelineRef}
              customVariants={revealVariants}
              className="lg:text-xl text-slate-400 sm:text-lg text-sm max-w-2xl mx-auto"
            >
              Monitor every reflex arc, immune response, and genome drift in real time. 
              Select an organ to view deeper insights and historic proofs.
            </TimelineContent>
          </article>

          {/* Dashboard Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[240px] gap-4 pt-16">
            {systemCards.map((card, index) => {
              const getGridSpan = (i: number) => {
                switch (i) {
                  case 0: return "md:col-span-2 md:row-span-2";
                  case 1: return "md:col-span-2 md:row-span-1";
                  case 2: return "md:col-span-1 md:row-span-1";
                  case 3: return "md:col-span-1 md:row-span-1";
                  case 4: return "md:col-span-2 md:row-span-1";
                  case 5: return "md:col-span-1 md:row-span-1";
                  case 6: return "md:col-span-1 md:row-span-1";
                  default: return "md:col-span-1";
                }
              };

              return (
                <Link
                  key={index}
                  href={card.url}
                  prefetch={true}
                  className={cn(
                    "block h-full w-full",
                    getGridSpan(index)
                  )}
                >
                  <TimelineContent
                    as="div"
                    animationNum={index + 5}
                    timelineRef={timelineRef}
                    className={cn(
                      "transition-all duration-500 rounded-2xl overflow-hidden relative group hover:scale-[1.015] h-full w-full",
                      "border border-white/10 hover:border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.02)] hover:shadow-[0_0_35px_rgba(255,255,255,0.08)]",
                    )}
                  >
                    <figure className="relative h-full w-full bg-slate-900">
                      <Image
                        src={card.imgSrc}
                        alt={card.name}
                        width={800}
                        height={800}
                        className="w-full h-full object-cover rounded-2xl opacity-80 group-hover:opacity-100 transition-opacity duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                    </figure>

                    <ProgressiveBlur
                      className="pointer-events-none absolute bottom-0 left-0 h-[60%] w-full"
                      blurIntensity={0.6}
                    />

                    <div className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20 shadow-xl">
                      <ArrowUpRight className="h-5 w-5 pointer-events-none" />
                    </div>

                    <div className="sm:py-6 py-4 sm:px-6 px-4 absolute bottom-0 left-0 w-full z-20 pr-16">
                      <h2 className="2xl:text-3xl xl:text-2xl md:text-xl text-lg font-bold leading-tight text-white drop-shadow-md mb-1">
                        {card.name}
                      </h2>
                      <p className="text-white/90 text-xs sm:text-sm font-medium drop-shadow-sm line-clamp-2">
                        {card.desc}
                      </p>
                    </div>
                  </TimelineContent>
                </Link>
              );
            })}
          </div>

        </div>
      </div>

      <CinematicFooter />
    </>
  );
}
