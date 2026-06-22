"use client";
import React, { useRef } from "react";
import { motion, useTransform, useSpring, useMotionValue } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  BarChart3,
  CheckCircle,
  ArrowRight,
  LucideIcon,
} from "lucide-react";

const INK = "#18181b";
const ACCENT = { emerald: "#059669", red: "#dc2626", blue: "#2563eb", amber: "#d97706" };

interface CardProps {
  title: string;
  description: string;
  Icon: LucideIcon;
  accent: string;
  index: number;
}

const Card: React.FC<CardProps> = ({ title, description, Icon, accent, index }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["8deg", "-8deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-8deg", "8deg"]);

  // Cache the card's bounds on enter so mousemove never reads layout (avoids
  // getBoundingClientRect → transform-write thrash on every pointer move).
  const rectRef = useRef<DOMRect | null>(null);
  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>): void => {
    rectRef.current = e.currentTarget.getBoundingClientRect();
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    const rect = rectRef.current;
    if (!rect) return;
    const xPct = (e.clientX - rect.left) / rect.width - 0.5;
    const yPct = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = (): void => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.12, ease: [0.23, 1, 0.32, 1] }}
      viewport={{ once: true }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      whileHover={{ y: -4 }}
      className="group relative flex h-100 md:h-105 w-[calc(100vw-48px)] md:w-95 shrink-0 flex-col rounded-2xl p-7 md:p-9 shadow-[5px_5px_0px_#18181b] transition-shadow duration-300 hover:shadow-[8px_8px_0px_#18181b]"
    >
      <div style={{ background: "#fff", border: `2px solid ${INK}` }} className="absolute inset-0 -z-10 rounded-2xl" />
      <div style={{ transform: "translateZ(40px)" }} className="flex h-full flex-col">
        <div
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl"
          style={{ background: accent, border: `2px solid ${INK}` }}
        >
          <Icon size={26} strokeWidth={1.75} style={{ color: "#fff" }} />
        </div>

        <h3 className="mb-3 text-2xl md:text-3xl font-black tracking-tight" style={{ color: INK }}>
          {title}
        </h3>

        <p className="mb-6 text-[14px] md:text-base font-medium leading-relaxed" style={{ color: `${INK}88` }}>
          {description}
        </p>

        <div className="mt-auto flex items-center text-xs md:text-sm font-extrabold uppercase tracking-widest" style={{ color: INK }}>
          <span className="relative">
            View Proof Record
            <span className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-current transition-transform duration-500 group-hover:scale-x-100" />
          </span>
          <motion.div className="ml-3" animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            <ArrowRight size={18} />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

interface CardData {
  title: string;
  description: string;
  Icon: LucideIcon;
  accent: string;
}

export function Component(): React.ReactElement {
  const carouselRef = useRef<HTMLDivElement>(null);

  const cards: CardData[] = [
    {
      title: "Behaviour-Equivalence Proof",
      description:
        "Every patch runs inside a disposable shadow twin before it ever reaches your repository. We don't trust a diff because it looks right — we trust the stored PROMOTE record.",
      Icon: Shield,
      accent: ACCENT.blue,
    },
    {
      title: "Replayed Against Reality",
      description:
        "Each verification replays real production cases against the candidate change, counting every regression before a verdict is reached.",
      Icon: BarChart3,
      accent: ACCENT.amber,
    },
    {
      title: "Promote or Reject",
      description:
        "There is no partial credit. A proof either clears every replayed case with zero regressions, or it is rejected outright — the Shadow invariant is inviolable.",
      Icon: CheckCircle,
      accent: ACCENT.emerald,
    },
  ];

  const scrollLeft = (): void =>
    carouselRef.current?.scrollBy({ left: -400, behavior: "smooth" });

  const scrollRight = (): void =>
    carouselRef.current?.scrollBy({ left: 400, behavior: "smooth" });

  return (
    <section className="relative py-16 md:py-24">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 md:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
          className="mb-12 md:mb-16 max-w-2xl text-center"
        >
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5"
            style={{ background: INK, border: `2px solid ${INK}` }}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "#fff" }} />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.25em]" style={{ color: "#fff" }}>
              Shadow Twin Runtime
            </span>
          </div>
          <h2
            className="mb-5 text-4xl sm:text-5xl md:text-6xl font-black tracking-tight"
            style={{ color: INK, textTransform: "uppercase" }}
          >
            Proven. Not Promised.
          </h2>
          <p className="text-sm md:text-base font-bold leading-relaxed" style={{ color: `${INK}88` }}>
            We do not promote on hope. Every change earns its way to production through a stored, inspectable proof.
          </p>
        </motion.div>

        {/* Carousel */}
        <div className="relative w-full">
          <div className="mb-6 flex justify-end gap-3">
            <button
              onClick={scrollLeft}
              aria-label="Scroll left"
              className="memphis-press rounded-full p-3"
              style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: `3px 3px 0px ${INK}` }}
            >
              <ChevronLeft size={18} style={{ color: INK }} />
            </button>
            <button
              onClick={scrollRight}
              aria-label="Scroll right"
              className="memphis-press rounded-full p-3"
              style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: `3px 3px 0px ${INK}` }}
            >
              <ChevronRight size={18} style={{ color: INK }} />
            </button>
          </div>

          <div
            ref={carouselRef}
            className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto px-1 pb-4 pt-2 scroll-smooth"
            style={{ perspective: "2000px" }}
          >
            {cards.map((card, idx) => (
              <div key={card.title} className="shrink-0 snap-center">
                <Card {...card} index={idx} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
