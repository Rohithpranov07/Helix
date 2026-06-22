"use client";
import React, { useEffect, useRef } from "react";
import { motion, useTransform, useSpring, useMotionValue } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Dna,
  ShieldCheck,
  Activity,
  ArrowRight,
  LucideIcon,
} from "lucide-react";

interface CardProps {
  title: string;
  description: string;
  Icon: LucideIcon;
  index: number;
}

const Card: React.FC<CardProps> = ({ title, description, Icon, index }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
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
      transition={{
        duration: 0.7,
        delay: index * 0.15,
        ease: [0.23, 1, 0.32, 1],
      }}
      viewport={{ once: true }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className="relative bg-[#0d1726]/60 border border-white/10 p-8 md:p-10 rounded-4xl md:rounded-[2.5rem] flex flex-col h-100 md:h-112.5 w-[calc(100vw-48px)] md:w-95 transition-colors duration-500 group"
    >
      <div
        style={{ transform: "translateZ(50px)" }}
        className="flex flex-col h-full"
      >
        <div className="mb-6 md:mb-8 w-14 h-14 md:w-16 md:h-16 bg-white/5 rounded-2xl flex items-center justify-center text-white group-hover:bg-white group-hover:text-black transition-all duration-500 ease-out shadow-sm group-hover:shadow-xl">
          <Icon size={28} strokeWidth={1.2} className="md:w-8 md:h-8" />
        </div>

        <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 md:mb-5 tracking-tight">
          {title}
        </h3>

        <p className="text-white/50 text-base md:text-lg leading-relaxed mb-6 md:mb-8 font-light line-clamp-3 md:line-clamp-none">
          {description}
        </p>

        <div className="mt-auto flex items-center text-xs md:text-sm font-bold text-white uppercase tracking-widest overflow-hidden">
          <span className="relative">
            Discover More
            <span className="absolute bottom-0 left-0 w-full h-px bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
          </span>
          <motion.div
            className="ml-3"
            animate={{ x: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <ArrowRight size={18} />
          </motion.div>
        </div>
      </div>

      <div className="absolute inset-0 rounded-4xl md:rounded-[2.5rem] bg-[rgba(80,140,255,0.15)] -z-10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 translate-y-8 scale-95" />
    </motion.div>
  );
};

interface CardData {
  title: string;
  description: string;
  Icon: LucideIcon;
}

export function FeatureCardCarousel(): React.ReactElement {
  const carouselRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const handleGlobalMouseMove = (e: MouseEvent): void => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        if (spotlightRef.current) {
          spotlightRef.current.style.background = `radial-gradient(circle 600px at ${e.clientX}px ${e.clientY}px, rgba(80,140,255,0.08), transparent 80%)`;
        }
        frame = 0;
      });
    };
    window.addEventListener("mousemove", handleGlobalMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const cards: CardData[] = [
    {
      title: "Living Genome",
      description:
        "Intent is captured as a strand and base-paired against the codebase continuously, so drift between what you meant and what shipped is caught before it compounds.",
      Icon: Dna,
    },
    {
      title: "Immune Response",
      description:
        "Every change is scanned, classified, and matched against an antibody library. Known threats are neutralized on sight; novel ones are learned and remembered.",
      Icon: ShieldCheck,
    },
    {
      title: "Vital Signs",
      description:
        "Entropy, incidents, and homeostasis are tracked as a continuous time-series, giving you a living read on the health of the system at every moment.",
      Icon: Activity,
    },
  ];

  const scrollLeft = (): void =>
    carouselRef.current?.scrollBy({
      left: -window.innerWidth * 0.8,
      behavior: "smooth",
    });

  const scrollRight = (): void =>
    carouselRef.current?.scrollBy({
      left: window.innerWidth * 0.8,
      behavior: "smooth",
    });

  return (
    <div className="relative w-full min-h-screen text-white overflow-hidden flex flex-col items-center justify-center">
      {/* Dynamic background spotlight, following the cursor. Mutated directly
          via ref in a rAF-throttled listener — avoids a React re-render (and
          re-rendering the cards below) on every mousemove event. */}
      <div
        ref={spotlightRef}
        className="pointer-events-none fixed inset-0 z-0 hidden md:block"
      />

      <main className="flex flex-col items-center justify-center w-full px-4 md:px-6 py-12 relative z-10">
        <header className="text-center mb-16 md:mb-24 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-6 md:mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[rgba(180,210,255,0.9)] animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                Organ Capabilities
              </span>
            </div>
            <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter mb-6 md:mb-8 bg-clip-text text-transparent bg-linear-to-b from-white to-white/40">
              Built to Survive.
            </h1>
            <p className="text-base md:text-xl text-white/50 font-light leading-relaxed px-4">
              HELIX does not patch symptoms; it closes the gap between intent
              and reality, continuously, on its own.
            </p>
          </motion.div>
        </header>

        <div className="relative w-full max-w-350 mx-auto">
          <div className="flex justify-end gap-3 md:gap-4 mb-6 md:mb-8 pr-4 md:pr-12">
            <button
              onClick={scrollLeft}
              className="group p-4 md:p-5 bg-white/5 hover:bg-white text-white hover:text-black rounded-full border border-white/10 transition-all duration-500"
            >
              <ChevronLeft
                size={18}
                className="group-hover:-translate-x-1 transition-transform"
              />
            </button>
            <button
              onClick={scrollRight}
              className="group p-4 md:p-5 bg-white/5 hover:bg-white text-white hover:text-black rounded-full border border-white/10 transition-all duration-500"
            >
              <ChevronRight
                size={18}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>
          </div>

          <div
            ref={carouselRef}
            className="flex gap-6 md:gap-10 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-16 md:pb-20 pt-4 md:pt-10 px-6 md:px-10 scroll-smooth"
            style={{ perspective: "2000px" }}
          >
            {cards.map((card, idx) => (
              <div key={idx} className="snap-center shrink-0">
                <Card {...card} index={idx} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
