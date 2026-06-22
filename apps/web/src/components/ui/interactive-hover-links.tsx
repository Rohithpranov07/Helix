"use client";

import { useMotionValue, motion, useSpring, useTransform } from "motion/react";
import React, { useRef } from "react";
import { ArrowRight } from "lucide-react";

interface OrganDef {
  /** Biological role / function category — small mono tag */
  tag: string;
  /** Organ name */
  heading: string;
  /** What this organ actually does — one informative sentence */
  description: string;
  imgSrc: string;
  href: string;
  /** Signature accent hue for this organ */
  accent: string;
}

interface InteractiveHoverLinksProps {
  organs?: OrganDef[];
}

export function InteractiveHoverLinks({ organs = HELIX_ORGANS }: InteractiveHoverLinksProps) {
  return (
    <section className="w-full px-4 md:px-8 pb-8 md:pb-16">
      <div className="mx-auto max-w-5xl">
        {/* Intro — frames the section as a guided tour of the organism, fades in on mount */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl text-base md:text-lg leading-relaxed text-slate-600 mb-10 md:mb-14"
        >
          HELIX runs as a living organism. Each organ watches one form of
          divergence — intent drift, vulnerabilities, entropy, failure — and
          acts on it autonomously. Explore how each one keeps your software
          aligned over time.
        </motion.p>

        {organs.map((organ, i) => (
          <motion.div
            key={organ.heading}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          >
            <OrganRow index={i} {...organ} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function OrganRow({
  tag,
  heading,
  description,
  imgSrc,
  href,
  accent,
  index,
}: OrganDef & { index: number }) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  // Cache the row's bounds on enter so mousemove never reads layout (avoids
  // getBoundingClientRect → transform-write thrash on every pointer move).
  const rectRef = useRef<DOMRect | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const top  = useTransform(mouseYSpring, [0.5, -0.5], ["40%", "60%"]);
  const left = useTransform(mouseXSpring, [0.5, -0.5], ["60%", "40%"]);

  const handleMouseEnter = () => {
    rectRef.current = ref.current?.getBoundingClientRect() ?? null;
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = rectRef.current;
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width  - 0.5);
    y.set((e.clientY - rect.top)  / rect.height - 0.5);
  };

  return (
    <motion.a
      href={href}
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      initial="initial"
      whileHover="whileHover"
      className="group relative flex items-center justify-between gap-6 px-4 py-7 md:px-6 md:py-9"
    >
      {/* Base hairline divider */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-black/[0.08]" />
      {/* Accent line that sweeps across the divider on hover */}
      <motion.span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px origin-left"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}00)` }}
        variants={{ initial: { scaleX: 0, opacity: 0 }, whileHover: { scaleX: 1, opacity: 1 } }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
      {/* Soft accent wash blooming from the left on hover */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-0 right-0 rounded-2xl"
        style={{ background: `radial-gradient(40% 120% at 4% 50%, ${accent}1f 0%, transparent 60%)` }}
        variants={{ initial: { opacity: 0 }, whileHover: { opacity: 1 } }}
        transition={{ duration: 0.5 }}
      />
      {/* Glowing accent rail that grows on hover */}
      <motion.span
        aria-hidden
        className="absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-full"
        style={{ background: accent, boxShadow: `0 0 16px ${accent}` }}
        variants={{ initial: { height: 0, opacity: 0 }, whileHover: { height: "58%", opacity: 1 } }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
      />

      <div className="relative z-10 min-w-0">
        {/* Index + function tag */}
        <div className="mb-2.5 flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.25em]">
          <span className="text-slate-400">{String(index + 1).padStart(2, "0")}</span>
          <span className="h-px w-5" style={{ background: `${accent}66` }} />
          <span
            className="text-slate-500 transition-colors duration-500 group-hover:[color:var(--organ-accent)]"
            style={{ ["--organ-accent" as string]: accent }}
          >
            {tag}
          </span>
        </div>

        {/* Organ name — per-letter spring on hover */}
        <motion.span
          variants={{ initial: { x: 0 }, whileHover: { x: -14 } }}
          transition={{ type: "spring", staggerChildren: 0.05, delayChildren: 0.15 }}
          className="block text-4xl font-black tracking-tight text-slate-800 transition-colors duration-500 group-hover:text-slate-950 md:text-6xl"
        >
          {heading.split("").map((l, i) => (
            <motion.span
              key={i}
              variants={{ initial: { x: 0 }, whileHover: { x: 14 } }}
              transition={{ type: "spring" }}
              className="inline-block"
            >
              {l === " " ? " " : l}
            </motion.span>
          ))}
        </motion.span>

        {/* Informative description */}
        <span className="mt-3 block max-w-xl text-sm md:text-base leading-relaxed text-slate-600 transition-colors duration-500 group-hover:text-slate-800">
          {description}
        </span>
      </div>

      {/* Mouse-follow image reveal, ringed and glowing in the organ accent */}
      <motion.img
        style={{ top, left, translateX: "-10%", translateY: "-50%", boxShadow: `0 24px 60px -18px ${accent}cc`, borderColor: accent }}
        variants={{
          initial: { scale: 0, rotate: "-12.5deg" },
          whileHover: { scale: 1,  rotate: "12.5deg"  },
        }}
        transition={{ type: "spring" }}
        src={imgSrc}
        className="absolute z-0 h-24 w-32 rounded-2xl border-2 object-cover md:h-48 md:w-64 pointer-events-none"
        alt={`${heading} organ`}
      />

      {/* Button-in-button arrow that fills with the organ accent on hover */}
      <div className="relative z-10 shrink-0">
        <motion.div
          variants={{ initial: { x: 24, opacity: 0 }, whileHover: { x: 0, opacity: 1 } }}
          transition={{ type: "spring", stiffness: 240, damping: 24 }}
          className="flex size-12 items-center justify-center rounded-full md:size-14"
          style={{ background: accent, boxShadow: `0 12px 28px -10px ${accent}` }}
        >
          <ArrowRight className="size-5 text-white transition-transform duration-300 group-hover:translate-x-0.5 md:size-6" strokeWidth={2.5} />
        </motion.div>
      </div>
    </motion.a>
  );
}

export const HELIX_ORGANS: OrganDef[] = [
  {
    tag: "Alignment",
    heading: "Genome",
    description:
      "Pairs every strand of declared intent to the code that implements it across all modules. When code drifts from what it was meant to do, the genome flags the divergence before it spreads.",
    imgSrc: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    href: "/dashboard/genome",
    accent: "#38bdf8",
  },
  {
    tag: "Defense",
    heading: "Immune",
    description:
      "Continuously scans for SQLi, XSS, auth bypass, secret leaks and missing RLS. It synthesizes a patch, proves it, and heals the vulnerability autonomously — no human in the loop.",
    imgSrc: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=800&q=80",
    href: "/dashboard/immune",
    accent: "#ef4444",
  },
  {
    tag: "Memory",
    heading: "Antibodies",
    description:
      "A vector library of every threat the system has ever seen. When a familiar pattern reappears anywhere in the codebase, immune memory recognizes it instantly and blocks recurrence permanently.",
    imgSrc: "https://images.unsplash.com/photo-1576086213369-97a306d36557?w=800&q=80",
    href: "/dashboard/antibodies",
    accent: "#818cf8",
  },
  {
    tag: "Entropy",
    heading: "Metabolism",
    description:
      "Computes the entropy field across the entire repository, tracking the codebase's rising temperature and projecting when accumulated disorder will force a rewrite.",
    imgSrc: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
    href: "/dashboard/metabolism",
    accent: "#a78bfa",
  },
  {
    tag: "Recovery",
    heading: "Reflex",
    description:
      "The nervous system detects production incidents, reconstructs the causal chain, and fires a resurrection reflex — restoring service with zero downtime while it diagnoses the root cause.",
    imgSrc: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80",
    href: "/dashboard/incidents",
    accent: "#f97316",
  },
  {
    tag: "Proof",
    heading: "Shadow",
    description:
      "Every change runs first inside a shadow twin. No write ever reaches production without a behaviour-equivalence proof — the Shadow invariant that makes self-healing safe.",
    imgSrc: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80",
    href: "/dashboard/shadow",
    accent: "#c084fc",
  },
  {
    tag: "Telemetry",
    heading: "Activity",
    description:
      "A live stream of every reflex arc across every organ — what was detected, what acted, and what it proved — so the whole organism is observable in real time.",
    imgSrc: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    href: "/dashboard/logs",
    accent: "#22c55e",
  },
];
