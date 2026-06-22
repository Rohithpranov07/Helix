"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { CinematicFooter } from "@/components/ui/motion-footer";
import { AmbientBackground } from "@/components/ui/ambient-background";
import { InteractiveHoverLinks } from "@/components/ui/interactive-hover-links";
import { Component as FeatureCarousel } from "@/components/ui/feature-carousel";
import {
  motion, useInView, useSpring, useTransform, useMotionValue, useReducedMotion,
  useScroll, type Variants, AnimatePresence,
} from "motion/react";
import { ArrowUpRight, Cpu, ShieldCheck, Zap, Lock, type LucideIcon } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface VitalsSnapshot {
  entropy?: { temperature: number; projectedRewriteWeeks: number } | null;
  immune?: { open: number; healed: number; total: number };
  genome?: { pairingPct?: number | null; avgScore?: number | null; totalUnpaired: number; modules: number; paired: number };
  nervous?: { total: number; resolved: number; recent: Array<{ incidentId: string; detectedAt: string; resolved: boolean; userImpactSeconds: number }> };
  memory?: { antibodies: number; recurrencesBlocked: number };
  shadow?: { total: number; promoted: number; rejected: number } | null;
  heartRate?: { deploysPerDay: number; incidentsPerDay: number };
  metabolism?: { lastTemp: number | null; projectedWeeks: number | null } | null;
}

interface VitalsData {
  entropy: { temperature: number; projectedRewriteWeeks: number } | null;
  immune: { open: number; healed: number; total: number };
  genome: { pairingPct: number | null; avgScore: number | null; totalUnpaired: number; modules: number; paired: number };
  nervous: { total: number; resolved: number; recent: Array<{ incidentId: string; detectedAt: string; resolved: boolean; userImpactSeconds: number }> };
  memory: { antibodies: number; recurrencesBlocked: number };
  shadow: { total: number; promoted: number; rejected: number } | null;
  heartRate: { deploysPerDay: number; incidentsPerDay: number };
  metabolism: { lastTemp: number | null; projectedWeeks: number | null } | null;
}

const DEMO: VitalsData = {
  entropy: { temperature: 0.62, projectedRewriteWeeks: 14 },
  immune: { open: 2, healed: 44, total: 47 },
  genome: { pairingPct: 84, avgScore: 0.84, totalUnpaired: 2, modules: 5, paired: 5 },
  nervous: { total: 3, resolved: 3, recent: [{ incidentId: "inc-01", detectedAt: new Date(Date.now() - 7200000).toISOString(), resolved: true, userImpactSeconds: 71 }] },
  memory: { antibodies: 48, recurrencesBlocked: 3 },
  shadow: { total: 12, promoted: 11, rejected: 1 },
  heartRate: { deploysPerDay: 4, incidentsPerDay: 0 },
  metabolism: { lastTemp: 0.62, projectedWeeks: 14 },
};

// ── Emil: strong ease-out — starts fast, feels responsive ──────────────────────
const E_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

// ── Entry variants — scale from 0.97 (never 0), tighter stagger ───────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.045, duration: 0.55, ease: E_OUT },
  }),
};

// ── Animated counter ───────────────────────────────────────────────────────────

function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const start = Date.now();
    const dur = 900;
    const tick = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      setDisplay(Math.round((1 - Math.pow(1 - p, 3)) * value));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span>{display}{suffix}</span>;
}

// ── Organ tiles — image-led bento, one cinematic render per organ ───────────────

interface Organ {
  key: string;
  href: string;
  span: string;
  img: string;
  alt: string;
  accent: string;
  label: string;
  title: string;
  tagline: string;
}

const ORGANS: Organ[] = [
  {
    key: "logs", href: "/dashboard/logs", span: "md:col-span-2 md:row-span-2",
    img: "/dash-logs.jpg", alt: "Streams of live signal flowing through the nervous system",
    accent: "#22c55e", label: "Nervous Signal", title: "Activity Stream",
    tagline: "Every reflex arc fires here in real time — security, genome, incidents.",
  },
  {
    key: "immune", href: "/dashboard/immune", span: "md:col-span-2",
    img: "/dash-immune.jpg", alt: "A shield deflecting orbiting pathogens",
    accent: "#ef4444", label: "Defense", title: "Immune System",
    tagline: "Threats found, patched, and proven — before they reach you.",
  },
  {
    key: "genome", href: "/dashboard/genome", span: "md:col-span-1",
    img: "/dash-genome.jpg", alt: "A double-helix strand of source intent",
    accent: "#38bdf8", label: "Integrity", title: "Genome",
    tagline: "Intent base-paired to code.",
  },
  {
    key: "reflex", href: "/dashboard/incidents", span: "md:col-span-1",
    img: "/dash-reflex.jpg", alt: "A spark of resurrection energy",
    accent: "#f97316", label: "Recovery", title: "Reflex",
    tagline: "Failures reversed on contact.",
  },
  {
    key: "metabolism", href: "/dashboard/metabolism", span: "md:col-span-2",
    img: "/dash-metabolism.jpg", alt: "Heat rising as entropy accumulates",
    accent: "#a78bfa", label: "Entropy", title: "Metabolism",
    tagline: "Entropy measured over time — so rot never compounds in the dark.",
  },
  {
    key: "antibody", href: "/dashboard/antibodies", span: "md:col-span-1",
    img: "/dash-antibody.jpg", alt: "A lattice of stored antibodies",
    accent: "#818cf8", label: "Memory", title: "Antibodies",
    tagline: "Defenses that never fade.",
  },
  {
    key: "shadow", href: "/dashboard/shadow", span: "md:col-span-1",
    img: "/dash-shadow.jpg", alt: "A twin running in shadow for verification",
    accent: "#c084fc", label: "Verification", title: "Shadow",
    tagline: "No write ships without proof.",
  },
];

// ── Stats strip ────────────────────────────────────────────────────────────────

interface Stat {
  label: string;
  value: number | string;
  color: string;
  grad: string;
  num: boolean;
  icon: LucideIcon;
}

function StatChip({ stat, index }: { stat: Stat; index: number }) {
  const reduce = useReducedMotion();
  const Icon = stat.icon;
  const { color } = stat;

  return (
    // Surrealism — a weightless dream-object: ethereal halo, melting asymmetric
    // form, dreamscape gradient. The inner layer drifts and tilts as if in a dream.
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.46 + index * 0.09, duration: 0.75, ease: E_OUT }}
      className="relative select-none"
    >
      {/* Dream halo — soft bloom hovering behind, hinting the object floats free */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-2.5 rounded-full opacity-55 blur-2xl"
        style={{ background: `radial-gradient(58% 58% at 50% 50%, ${color}aa, transparent 70%)` }}
      />

      {/* Floating object — bobs and tilts on a slow, dreamlike loop */}
      <motion.div
        className="relative overflow-hidden"
        style={{
          borderRadius: "26px 9px 26px 9px",
          background: stat.grad,
          boxShadow: `0 20px 40px -16px ${color}cc, 0 8px 18px -10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.5)`,
        }}
        {...(reduce
          ? {}
          : {
              animate: { y: [0, -6, 0], rotate: [-1.2, 1.2, -1.2] },
              transition: { duration: 5 + index * 0.8, repeat: Infinity, ease: "easeInOut" as const },
            })}
      >
        {/* Inner dream-light pooling from the upper-left */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(70% 90% at 18% 8%, rgba(255,255,255,0.5), transparent 55%)" }}
        />
        <div className="relative flex items-center gap-3 px-4 py-3">
          {/* Glowing dream-orb holding the icon */}
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{
              background:
                "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95), rgba(255,255,255,0.35) 60%, rgba(255,255,255,0.1))",
              boxShadow: `inset 0 1px 2px rgba(255,255,255,0.9), 0 5px 12px -4px ${color}, 0 0 0 1px rgba(255,255,255,0.4)`,
            }}
          >
            <Icon className="h-[17px] w-[17px]" strokeWidth={2.4} style={{ color }} />
          </span>
          <div className="leading-none">
            <div
              className="text-lg font-black tabular-nums text-white"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
            >
              {stat.num ? <Counter value={stat.value as number} /> : stat.value}
            </div>
            <div
              className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/90"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
            >
              {stat.label}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatsStrip({ v }: { v: VitalsData }) {
  const stats: Stat[] = [
    {
      label: "Antibodies", value: v.memory.antibodies, num: true, icon: Cpu,
      color: "#c2a14e",
      grad: "linear-gradient(112deg, #8c6d28 0%, #b8943f 40%, #d8be7e 74%, #f1e3bd 100%)",
    },
    {
      label: "Vulns Healed", value: v.immune.healed, num: true, icon: ShieldCheck,
      color: "#3f9b7e",
      grad: "linear-gradient(112deg, #1d6452 0%, #3a8f74 40%, #79c2a4 74%, #c6e6d6 100%)",
    },
    {
      label: "Incidents Resolved", value: `${v.nervous.resolved}/${v.nervous.total}`, num: false, icon: Zap,
      color: "#c46b6f",
      grad: "linear-gradient(112deg, #8f4148 0%, #b76368 40%, #dd9690 74%, #f2d2c7 100%)",
    },
    {
      label: "Shadow Promoted", value: v.shadow ? `${v.shadow.promoted}/${v.shadow.total}` : "—", num: false, icon: Lock,
      color: "#6d5fb3",
      grad: "linear-gradient(112deg, #443a7d 0%, #6253a6 40%, #978ad0 74%, #d6cdee 100%)",
    },
  ];
  return (
    <div className="mb-14 mt-2 flex flex-wrap items-center justify-center gap-5 md:gap-6">
      {stats.map((s, i) => (
        <StatChip key={s.label} stat={s} index={i} />
      ))}
    </div>
  );
}

// ── Scroll reveal — scroll-linked rise + fade as a section enters view ──

function ScrollReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start 55%"],
  });
  // Section gently rises and fades in as it scrolls up into view
  const rawY = useTransform(scrollYProgress, [0, 1], [70, 0]);
  const y = useSpring(rawY, { stiffness: 90, damping: 22, mass: 0.6 });
  const opacity = useTransform(scrollYProgress, [0, 0.6], [0, 1]);

  return (
    <motion.div ref={ref} style={{ y, opacity }}>
      {children}
    </motion.div>
  );
}

// ── Organs reveal — premium scroll-in header bridging vitals → organs ──

function OrgansReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-18% 0px -18% 0px" });
  const E: [number, number, number, number] = [0.23, 1, 0.32, 1];
  const words = ["Meet", "the", "organism."];

  return (
    <div ref={ref} className="relative mx-auto max-w-5xl px-4 md:px-8 pt-24 md:pt-32 pb-4">
      {/* Aurora glow blooming behind the headline */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-10 top-8"
        animate={{ opacity: isInView ? 1 : 0, scale: isInView ? 1 : 0.8 }}
        transition={{ duration: 1.6, ease: E }}
        style={{
          width: "min(760px, 95vw)",
          height: 280,
          background:
            "radial-gradient(ellipse 55% 60% at 22% 45%, rgba(34,197,94,0.22) 0%, rgba(14,165,233,0.10) 44%, transparent 74%)",
          filter: "blur(64px)",
        }}
      />

      {/* Eyebrow — line + mono label sweeping in */}
      <motion.div
        className="relative z-10 mb-6 flex items-center gap-4 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, ease: E }}
      >
        <motion.span
          className="h-px origin-left"
          style={{ width: 44, background: "linear-gradient(90deg, rgba(16,150,90,0.8), transparent)" }}
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : {}}
          transition={{ duration: 0.7, ease: E }}
        />
        <span className="font-mono text-[10px] tracking-[0.4em] uppercase text-emerald-600">
          System Organs
        </span>
      </motion.div>

      {/* Headline — word-by-word clip reveal */}
      <h2 className="relative z-10 text-5xl md:text-7xl font-black tracking-tight leading-[0.95] text-slate-900">
        {words.map((w, i) => (
          <span key={i} className="mr-[0.22em] inline-block overflow-hidden align-bottom">
            <motion.span
              className="inline-block"
              initial={{ y: "115%" }}
              animate={isInView ? { y: "0%" } : {}}
              transition={{ duration: 0.85, ease: E, delay: 0.12 + i * 0.09 }}
            >
              {w}
            </motion.span>
          </span>
        ))}
      </h2>
    </div>
  );
}

// ── Luminous divider — Linear-style glow horizon between links and footer ──

function SectionBlade() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, margin: "-25% 0px -25% 0px" });
  const E: [number, number, number, number] = [0.23, 1, 0.32, 1];

  return (
    <div
      ref={ref}
      className="relative flex items-center justify-center select-none overflow-hidden"
      style={{ height: "clamp(180px, 26vh, 300px)" }}
    >
      {/* Soft aurora bloom — large, low, anchored to the line */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2"
        animate={{ opacity: isInView ? 1 : 0, scale: isInView ? 1 : 0.7 }}
        transition={{ duration: 1.6, ease: E }}
        style={{
          width: "min(900px, 110vw)",
          height: 260,
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(34,197,94,0.22) 0%, rgba(14,165,233,0.12) 38%, transparent 72%)",
          filter: "blur(50px)",
        }}
      />

      {/* The divider line — bright center hotspot fading to transparent edges */}
      <div className="relative w-full max-w-4xl px-6" style={{ height: 1 }}>
        <motion.div
          aria-hidden
          className="absolute inset-0 origin-center"
          animate={{ scaleX: isInView ? 1 : 0.2, opacity: isInView ? 1 : 0 }}
          transition={{ duration: 1.3, ease: E }}
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(100,116,139,0.25) 30%, rgba(15,23,42,0.55) 50%, rgba(100,116,139,0.25) 70%, transparent 100%)",
          }}
        />
        {/* Center hotspot bloom — the bright point where light concentrates */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-1/2"
          animate={{ opacity: isInView ? 1 : 0, scale: isInView ? 1 : 0.3 }}
          transition={{ duration: 1.1, ease: E, delay: 0.15 }}
          style={{
            width: 180,
            height: 6,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(34,197,94,0.8) 0%, rgba(34,197,94,0.4) 35%, transparent 75%)",
            filter: "blur(3px)",
          }}
        />
        {/* Center node — single elegant diamond */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-1/2"
          animate={{ opacity: isInView ? 1 : 0, scale: isInView ? 1 : 0, rotate: 45 }}
          transition={{ duration: 0.8, ease: E, delay: 0.4 }}
          style={{
            width: 6,
            height: 6,
            transform: "translate(-50%, -50%) rotate(45deg)",
            background: "#16a34a",
            boxShadow:
              "0 0 12px rgba(34,197,94,0.7), 0 0 28px rgba(34,197,94,0.5)",
          }}
        />
      </div>
    </div>
  );
}

// ── Fine film grain — monochrome fractal noise, the "expensive" texture ───────
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// ── Card wrapper — spring tilt + grain + specular + spotlight ──────────────────

function DashCard({ organ, index }: { organ: Organ; index: number }) {
  const { span, href, img, alt, accent, label, title, tagline } = organ;
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, margin: "0px 0px -40px 0px" });
  const reduce = useReducedMotion();

  // Spring-based 3-D tilt driven by mouse position
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateY = useSpring(useTransform(rawX, [-0.5, 0.5], [-6, 6]), { stiffness: 280, damping: 28 });
  const rotateX = useSpring(useTransform(rawY, [-0.5, 0.5], [5, -5]), { stiffness: 280, damping: 28 });

  // Cursor spotlight — a soft light blob TRANSLATED to the pointer (Emil: transform only, GPU-composited).
  // Springs trail the cursor slightly so the light feels like it has weight, not a hard cursor-lock.
  const glowX = useMotionValue(-9999);
  const glowY = useMotionValue(-9999);
  const gx = useSpring(glowX, { stiffness: 350, damping: 35, mass: 0.4 });
  const gy = useSpring(glowY, { stiffness: 350, damping: 35, mass: 0.4 });

  // Cache the card bounds on enter so mousemove never reads layout (avoids
  // getBoundingClientRect → transform-write thrash on every pointer move).
  const rectRef = useRef<DOMRect | null>(null);
  const onMouseEnter = () => {
    rectRef.current = containerRef.current?.getBoundingClientRect() ?? null;
  };
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const rect = rectRef.current;
    if (!rect) return;
    rawX.set((e.clientX - rect.left) / rect.width - 0.5);
    rawY.set((e.clientY - rect.top) / rect.height - 0.5);
    glowX.set(e.clientX - rect.left);
    glowY.set(e.clientY - rect.top);
  };
  const onMouseLeave = () => { rawX.set(0); rawY.set(0); };

  return (
    <motion.div
      ref={containerRef}
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      style={reduce ? {} : { rotateX, rotateY, transformPerspective: 900 }}
      className={cn("group relative", span)}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <Link href={href} className="block h-full w-full">
        {/* Outer glow (behind card) — the organ's accent hue blooms softly on hover, lifting the tile off the light page */}
        <div
          className="absolute -inset-1 rounded-[20px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl pointer-events-none -z-10"
          style={{ background: `radial-gradient(60% 60% at 50% 80%, ${accent}55 0%, transparent 70%)` }}
        />

        {/* Card surface — self-contained dark media tile, framed to sit crisply on the light page */}
        <motion.div
          className={cn(
            "relative h-full w-full rounded-2xl overflow-hidden cursor-pointer",
            "ring-1 ring-black/5 transition-[box-shadow] duration-300",
          )}
          style={{
            backgroundColor: "#0a0b10",
            // Soft, light-page elevation: a gentle ambient shadow so the dark tile floats
            boxShadow:
              "0 1px 2px rgba(15,23,42,0.08), 0 12px 28px -12px rgba(15,23,42,0.22), 0 28px 56px -28px rgba(15,23,42,0.18)",
          }}
          {...(reduce ? {} : { whileHover: { scale: 1.013 }, whileTap: { scale: 0.97 } })}
          transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
        >
          {/* Organ render — full-bleed base layer, slow cinematic push-in on hover */}
          <Image
            src={img}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px"
            priority={index < 2}
            className="object-cover object-center scale-[1.05] transition-transform duration-1000 ease-out group-hover:scale-[1.13] will-change-transform"
          />

          {/* Legibility scrim — keeps the render luminous up top, ink at the base for text */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(10,11,16,0) 30%, rgba(10,11,16,0.55) 66%, rgba(10,11,16,0.92) 100%)",
            }}
          />

          {/* Accent wash — the organ's signature hue pools from the lower-left, blooms on hover */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-50 transition-opacity duration-500 group-hover:opacity-90"
            style={{ background: `radial-gradient(120% 85% at 0% 112%, ${accent}44 0%, transparent 56%)` }}
          />

          {/* Film grain — fine monochrome texture, gallery-grade materiality */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-soft-light"
            style={{ backgroundImage: GRAIN, backgroundSize: "120px 120px" }}
          />

          {/* Inner vignette — pulls focus inward, deepens the matte at the edges */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(125% 120% at 50% 28%, transparent 56%, rgba(0,0,0,0.32) 100%)" }}
          />

          {/* Top edge highlight — clip-path sweeps outward from center as card enters */}
          <motion.div
            className="absolute top-0 left-0 right-0 h-px opacity-60 group-hover:opacity-100 transition-opacity duration-300 z-10"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)" }}
            initial={{ clipPath: "inset(0 50% 0 50%)" }}
            animate={{ clipPath: "inset(0 0% 0 0%)" }}
            transition={{ duration: 0.9, delay: 0.12 + index * 0.045, ease: E_OUT }}
          />

          {/* Cursor spotlight — soft light blob that tracks the pointer via transform (GPU, no repaint) */}
          <motion.div
            aria-hidden
            className="absolute left-0 top-0 h-80 w-80 -ml-40 -mt-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              x: gx, y: gy,
              background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 30%, transparent 62%)",
            }}
          />

          {/* Light-traced edge — gradient hairline border, brightens on hover */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              padding: "1px",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.06) 38%, transparent 60%, rgba(255,255,255,0.12) 100%)",
              WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />

          {/* Content — label, title, tagline anchored to the base over the scrim */}
          <div className="relative z-10 flex h-full flex-col justify-end p-6">
            <div className="mb-3 flex items-center gap-2.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
              />
              <span
                className="font-mono text-[10px] font-medium uppercase tracking-[0.32em]"
                style={{ color: accent }}
              >
                {label}
              </span>
            </div>
            <h3 className="text-2xl font-semibold leading-none tracking-tight text-white md:text-[28px]">
              {title}
            </h3>
            <p className="mt-2.5 max-w-[26ch] text-[13px] leading-snug text-white/60 transition-colors duration-300 group-hover:text-white/85">
              {tagline}
            </p>
          </div>

          {/* Arrow — Emil: exit animations should feel instantly responsive */}
          <div
            className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-[opacity,transform] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-white/85" />
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [vitals, setVitals] = useState<VitalsData | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    // If /api/vitals hangs (e.g. MongoDB unreachable), give up quickly and fall
    // back to demo data so the page never gets stuck on the loading skeleton.
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; ac.abort(); }, 5000);
    try {
      const res = await fetch("/api/vitals", { signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { snapshot?: VitalsSnapshot };
      const s = json.snapshot ?? {};
      setVitals({
        entropy: s.entropy ?? null,
        immune: s.immune ?? DEMO.immune,
        genome: s.genome ? { ...s.genome, pairingPct: s.genome.pairingPct ?? null, avgScore: s.genome.avgScore ?? null } : DEMO.genome,
        nervous: s.nervous ?? DEMO.nervous,
        memory: s.memory ?? DEMO.memory,
        shadow: s.shadow ?? null,
        heartRate: s.heartRate ?? DEMO.heartRate,
        metabolism: s.metabolism ?? null,
      });
      setDemoMode(false);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // A timeout abort means the request stalled — fall back to demo data.
        // A refetch/unmount abort is superseded by a newer load, so skip.
        if (!timedOut) return;
        setVitals(DEMO);
        setDemoMode(true);
      } else {
        setVitals(DEMO);
        setDemoMode(true);
      }
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => { clearInterval(id); abortRef.current?.abort(); };
  }, [load]);

  const v = vitals ?? DEMO;

  return (
      <div className="relative text-slate-900 min-h-screen">
        {/* Ambient background — Editorial-Luxury warm cream canvas. Its own fixed,
            GPU-composited layer (replaces background-attachment:fixed, which would
            repaint the whole viewport every scroll frame). A few well-separated,
            soft colour orbs float over a warm cream-to-beige base — no desaturating
            wash, so the colour stays clean rather than muddy. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            backgroundColor: "#f6efe2",
            backgroundImage: [
              // Emerald orb — top-left
              "radial-gradient(38% 42% at 2% 0%, rgba(52,211,153,0.34) 0%, transparent 70%)",
              // Violet orb — top-right
              "radial-gradient(40% 44% at 100% 2%, rgba(167,139,250,0.34) 0%, transparent 70%)",
              // Warm peach orb — centre-low, the heart of the warmth
              "radial-gradient(50% 40% at 60% 70%, rgba(251,176,120,0.26) 0%, transparent 72%)",
              // Soft pink-violet orb — bottom-left, balances the peach
              "radial-gradient(42% 38% at 0% 100%, rgba(196,141,233,0.24) 0%, transparent 72%)",
              // Vertical warmth — luminous cream up top settling into deeper beige
              "linear-gradient(180deg, #fbf6ec 0%, #f6efe2 38%, #efe5d3 100%)",
            ].join(", "),
            backgroundSize: "100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%",
          }}
        />

        {/* Film grain — fixed, pointer-events-none paper texture for editorial materiality */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 opacity-[0.05] mix-blend-multiply"
          style={{ backgroundImage: GRAIN, backgroundSize: "150px 150px" }}
        />

        {/* Ambient decor — DNA strands, drifting bio-orbs, floating cells */}
        <AmbientBackground />

        {/* Demo banner */}
        <AnimatePresence>
          {demoMode && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: E_OUT }}
              className="w-full bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-xs text-amber-700 font-medium z-50 relative tracking-wide"
            >
              MongoDB offline — showing demo data
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-28 pb-16 max-w-screen-2xl mx-auto px-4 md:px-8">

            {/* ── Header ── */}
            <div className="text-center mb-12">

              {/* Hero — tall condensed display for Vitals/Organs, serif italic for the ampersand between */}
              <div className="flex flex-wrap items-baseline justify-center leading-[0.92]">
                {/* Vitals — tall condensed, near-white */}
                <span className="overflow-hidden inline-block pb-[0.08em]">
                  <motion.span
                    className="font-tall inline-block text-[clamp(3.5rem,11vw,7.5rem)] tracking-[0.01em]"
                    style={{
                      backgroundImage: "linear-gradient(180deg, #0f172a 0%, #334155 56%, #64748b 112%)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      color: "transparent",
                    }}
                    initial={{ y: "110%" }}
                    animate={{ y: 0 }}
                    transition={{ delay: 0.14, duration: 0.65, ease: E_OUT }}
                  >
                    Vitals
                  </motion.span>
                </span>

                {/* & — handwritten script ampersand, contrasts the tall condensed words around it */}
                <span className="overflow-hidden inline-block mx-[0.14em] pb-[0.08em]">
                  <motion.span
                    className="font-handwritten inline-block text-[clamp(2.75rem,8vw,5.5rem)]"
                    style={{
                      backgroundImage: "linear-gradient(180deg, rgba(15,23,42,0.65), rgba(15,23,42,0.28))",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      color: "transparent",
                    }}
                    initial={{ y: "110%" }}
                    animate={{ y: 0 }}
                    transition={{ delay: 0.21, duration: 0.55, ease: E_OUT }}
                  >
                    &
                  </motion.span>
                </span>

                {/* Organs — tall condensed, single violet accent */}
                <span className="overflow-hidden inline-block pb-[0.08em]">
                  <motion.span
                    className="font-tall inline-block text-[clamp(3.5rem,11vw,7.5rem)] tracking-[0.01em]"
                    style={{
                      backgroundImage: "linear-gradient(180deg, #a78bfa 0%, #8b5cf6 52%, #6d28d9 112%)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      color: "transparent",
                      filter: "drop-shadow(0 6px 28px rgba(167,139,250,0.28))",
                    }}
                    initial={{ y: "110%" }}
                    animate={{ y: 0 }}
                    transition={{ delay: 0.28, duration: 0.65, ease: E_OUT }}
                  >
                    Organs
                  </motion.span>
                </span>
              </div>

              {/* Subtext — legible muted body with violet emphasis, matching the Organs accent */}
              <motion.p
                custom={3} variants={fadeUp} initial="hidden" whileInView="visible"
                viewport={{ once: true, amount: 0.5 }}
                className="mt-6 text-[13px] md:text-sm tracking-[0.01em] max-w-md mx-auto leading-relaxed text-slate-500"
              >
                Every reflex arc, immune response, and genome drift —{" "}
                <span className="text-violet-700 font-medium">monitored live</span>.
              </motion.p>
            </div>

            {/* ── Stats strip ── */}
            <StatsStrip v={v} />

            {/* ── Bento Grid — cinematic image-led organ tiles ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[230px] md:auto-rows-[264px] gap-3 md:gap-4">
              {ORGANS.map((organ, i) => (
                <DashCard key={organ.key} organ={organ} index={i} />
              ))}
            </div>
          </div>

      {/* ── Organ Directory — scroll-linked rise + fade transition from vitals ── */}
      <ScrollReveal>
        <div className="relative mx-auto max-w-6xl px-4 md:px-8 pt-20 md:pt-28">
          {/* Frosted-glass panel — a calm reading surface over the colourful mesh */}
          <div
            className="relative overflow-hidden rounded-[36px] ring-1 ring-black/5 backdrop-blur-2xl"
            style={{
              background: "linear-gradient(160deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.55) 100%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.04), 0 40px 80px -40px rgba(15,23,42,0.22)",
            }}
          >
            <OrgansReveal />
            <InteractiveHoverLinks />
          </div>
        </div>
      </ScrollReveal>

      {/* ── Self-healing loop — feature carousel, scroll-revealed for a smooth handoff ── */}
      <ScrollReveal>
        <section className="mx-auto max-w-6xl px-4 md:px-8 pt-28 md:pt-36 pb-8">
          <div className="mb-10 md:mb-14">
            <div className="mb-5 flex items-center gap-4">
              <span className="h-px w-11" style={{ background: "linear-gradient(90deg, rgba(16,150,90,0.8), transparent)" }} />
              <span className="font-mono text-[10px] tracking-[0.4em] uppercase text-emerald-600">
                The Loop
              </span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.98] text-slate-900">
              One reflex, end to end.
            </h2>
            <p className="mt-4 max-w-2xl text-base md:text-lg leading-relaxed text-slate-500">
              Detect, diagnose, heal, prove — every divergence runs the same
              autonomous loop, from the first signal to a behaviour-equivalence
              proof before promotion.
            </p>
          </div>

          {/* Dark cinematic showcase — floats on a soft colored glow so the
              demo photos pop and it reads as an intentional product slab, not a box */}
          <div className="relative">
            {/* Colored aurora halo behind the slab */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 rounded-[44px] blur-3xl opacity-70"
              style={{
                background:
                  "radial-gradient(45% 60% at 18% 20%, rgba(52,211,153,0.5) 0%, transparent 70%), radial-gradient(50% 60% at 85% 30%, rgba(167,139,250,0.5) 0%, transparent 70%), radial-gradient(60% 70% at 50% 110%, rgba(251,176,120,0.4) 0%, transparent 70%)",
              }}
            />
            <div
              className="relative rounded-[32px] p-1.5 ring-1 ring-white/10"
              style={{
                background: "linear-gradient(160deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02))",
                boxShadow: "0 40px 90px -40px rgba(15,23,42,0.55)",
              }}
            >
              <div
                className="relative z-10 grid w-full gap-8 overflow-hidden rounded-[26px] p-2"
                style={{
                  background: "#0a0b12",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              >
                {/* Inner accent aurora for depth */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(60% 50% at 12% 0%, rgba(52,211,153,0.16) 0%, transparent 60%), radial-gradient(55% 50% at 90% 8%, rgba(167,139,250,0.16) 0%, transparent 60%)",
                  }}
                />
              <FeatureCarousel
                title="HELIX self-healing loop"
                description="The autonomous reflex that keeps software aligned over time"
                step1img1Class={cn(
                  "pointer-events-none w-[50%] border border-white/10 transition-all duration-500",
                  "max-md:scale-[160%] max-md:rounded-[24px] rounded-[24px] left-[25%] top-[57%] md:left-[35px] md:top-[29%]",
                  "md:group-hover:translate-y-2",
                )}
                step1img2Class={cn(
                  "pointer-events-none w-[60%] border border-white/10 transition-all duration-500 overflow-hidden",
                  "max-md:scale-[160%] rounded-2xl max-md:rounded-[24px] left-[69%] top-[53%] md:top-[21%] md:left-[calc(50%+35px+1rem)]",
                  "md:group-hover:-translate-y-6",
                )}
                step2img1Class={cn(
                  "pointer-events-none w-[50%] rounded-t-[24px] overflow-hidden border border-white/10 transition-all duration-500",
                  "max-md:scale-[160%] left-[25%] top-[69%] md:left-[35px] md:top-[30%]",
                  "md:group-hover:translate-y-2",
                )}
                step2img2Class={cn(
                  "pointer-events-none w-[40%] rounded-t-[24px] border border-white/10 transition-all duration-500 rounded-2xl overflow-hidden",
                  "max-md:scale-[140%] left-[70%] top-[53%] md:top-[25%] md:left-[calc(50%+27px+1rem)]",
                  "md:group-hover:-translate-y-6",
                )}
                step3imgClass={cn(
                  "pointer-events-none w-[90%] border border-white/10 rounded-t-[24px] transition-all duration-500 overflow-hidden",
                  "left-[5%] top-[50%] md:top-[30%] md:left-[68px]",
                )}
                step4imgClass={cn(
                  "pointer-events-none w-[90%] border border-white/10 rounded-t-[24px] transition-all duration-500 overflow-hidden",
                  "left-[5%] top-[50%] md:top-[30%] md:left-[68px]",
                )}
                image={{
                  step1light1: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80",
                  step1light2: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=1600&q=80",
                  step2light1: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1600&q=80",
                  step2light2: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&q=80",
                  step3light: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1600&q=80",
                  step4light: "https://images.unsplash.com/photo-1576086213369-97a306d36557?w=1600&q=80",
                  alt: "HELIX self-healing loop",
                }}
                bgClass="bg-transparent"
              />
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── Scan-blade transition into footer ── */}
      <SectionBlade />

      <CinematicFooter />
    </div>
  );
}
