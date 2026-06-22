"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Check, GitBranch, FileSearch, Dna } from "lucide-react";

const AGENT_STEPS = [
  {
    id: "01",
    title: "Agent Thinking",
    description: "Analyzing repository structure, detecting core architecture, and identifying vital invariant paths.",
    tag: "ARCHITECTURE SCAN",
    icon: GitBranch,
    details: [
      "Traversing /src directory tree...",
      "Identifying entry points & exports",
      "Mapping module dependency graph",
      "Detecting invariant candidates",
    ],
    image: "https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?q=80&w=1200",
    accent: "#1488fc",
  },
  {
    id: "02",
    title: "Reading Intent",
    description: "Deep-mapping the codebase against your intent document to establish functional expectations and encode behaviour contracts.",
    tag: "INTENT MAPPING",
    icon: FileSearch,
    details: [
      "Parsing intent document (2,847 tokens)",
      "Cross-referencing 42 modules",
      "Establishing invariant anchors",
      "Building expectation graph",
    ],
    image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200",
    accent: "#a78bfa",
  },
  {
    id: "03",
    title: "Synthesizing Genome",
    description: "Compiling the final genetic map of your application. Ready to establish the baseline for drift monitoring.",
    tag: "GENOME COMPILE",
    icon: Dna,
    details: [
      "Encoding genetic invariants",
      "Vectorizing intent embeddings",
      "Writing intent_strand to MongoDB",
      "Baseline genome established",
    ],
    image: "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?q=80&w=1200",
    accent: "#10b981",
  },
] as const;

const AUTO_PLAY_DURATION = 4500;

export function VerticalTabs({ onComplete, indexed }: { onComplete?: () => void; indexed?: number }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);

  const handleNext = useCallback(() => {
    if (activeIndex === AGENT_STEPS.length - 1) {
      setIsFinished(true);
      return;
    }
    setDirection(1);
    setActiveIndex((prev) => prev + 1);
  }, [activeIndex]);

  const handleTabClick = (index: number) => {
    if (index === activeIndex) return;
    setDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
    setIsPaused(false);
    if (index < AGENT_STEPS.length - 1) setIsFinished(false);
  };

  // Auto-advance timer
  useEffect(() => {
    if (isPaused || isFinished) return;
    const t = setInterval(() => handleNext(), AUTO_PLAY_DURATION);
    return () => clearInterval(t);
  }, [activeIndex, isPaused, isFinished, handleNext]);

  // Stagger terminal lines per step
  useEffect(() => {
    setVisibleLines(0);
    const step = AGENT_STEPS[activeIndex];
    if (!step) return;
    const timers = step.details.map((_, i) =>
      setTimeout(() => setVisibleLines(i + 1), (i + 1) * 700)
    );
    return () => timers.forEach(clearTimeout);
  }, [activeIndex]);

  const currentStep = AGENT_STEPS[activeIndex];
  if (!currentStep) return null;
  const AccentColor = currentStep.accent;

  const imageVariants = {
    enter: (dir: number) => ({ y: dir > 0 ? "-8%" : "8%", opacity: 0, scale: 1.04 }),
    center: { y: "0%", opacity: 1, scale: 1 },
    exit: (dir: number) => ({ y: dir > 0 ? "8%" : "-8%", opacity: 0, scale: 0.97 }),
  };

  return (
    <div className="w-full max-w-5xl mx-auto mt-6">
      <AnimatePresence mode="wait">
        {isFinished ? (
          /* ── COMPLETION STATE ── */
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-black/7 bg-white/85 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_30px_70px_-40px_rgba(15,23,42,0.3)] overflow-hidden"
          >
            <div className="flex flex-col items-center justify-center py-14 px-8 text-center">
              {/* Glow ring */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.05 }}
                className="relative mb-6"
              >
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl scale-150" />
                <div className="relative w-16 h-16 rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] flex items-center justify-center">
                  <Check className="size-7 text-emerald-400" strokeWidth={2.5} />
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="text-[10px] font-bold tracking-[0.25em] text-emerald-500 uppercase mb-3"
              >
                GENOME READY
              </motion.p>

              <motion.h3
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight mb-2"
              >
                {indexed != null ? `${indexed} modules indexed` : "Genome baseline ready"}
              </motion.h3>

              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
                className="text-[#6e6e73] text-sm leading-relaxed max-w-sm mb-8"
              >
                Baseline established. Authorize GitHub to complete the connection and activate drift monitoring.
              </motion.p>

              {/* Completed steps summary */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34 }}
                className="flex items-center gap-6 mb-8"
              >
                {AGENT_STEPS.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center">
                      <Check className="size-2.5 text-emerald-400" />
                    </div>
                    <span className="text-[11px] text-[#6e6e73] font-medium">{step.title}</span>
                    {i < AGENT_STEPS.length - 1 && (
                      <div className="w-4 h-[1px] bg-black/10 ml-2" />
                    )}
                  </div>
                ))}
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42 }}
                onClick={() => onComplete?.()}
                className="flex items-center gap-2.5 px-7 py-3 rounded-xl font-semibold text-sm bg-emerald-500 hover:bg-emerald-400 text-black transition-all duration-200 shadow-[0_0_32px_rgba(16,185,129,0.28)] hover:shadow-[0_0_44px_rgba(16,185,129,0.45)] active:scale-[0.98]"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                Approve & Connect via GitHub
              </motion.button>
            </div>
          </motion.div>
        ) : (
          /* ── PIPELINE STATE ── */
          <motion.div
            key="pipeline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-black/7 bg-white/85 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_30px_70px_-40px_rgba(15,23,42,0.3)] overflow-hidden"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 h-[520px]">

              {/* ── LEFT COLUMN: Steps ── */}
              <div className="lg:col-span-5 flex flex-col h-full border-r border-black/6 bg-white/60">

                {/* Header */}
                <div className="px-8 pt-8 pb-6 border-b border-black/6">
                  <span className="text-[10px] font-bold tracking-[0.28em] uppercase mb-1.5 block"
                    style={{ color: AccentColor }}>
                    AI Agent Pipeline
                  </span>
                  <h2 className="text-xl font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                    Processing request
                  </h2>
                </div>

                {/* Steps */}
                <div className="flex-1 flex flex-col px-8 py-6 gap-0 relative overflow-hidden">
                  {/* Connector line running through all circles */}
                  <div className="absolute left-[39px] top-[34px] bottom-[34px] w-[1px] bg-black/8" />

                  {AGENT_STEPS.map((step, index) => {
                    const isActive = activeIndex === index;
                    const isPast = index < activeIndex;
                    const Icon = step.icon;

                    return (
                      <button
                        key={step.id}
                        onClick={() => handleTabClick(index)}
                        className={cn(
                          "relative flex items-start gap-4 text-left transition-all duration-300 focus:outline-none group",
                          index < AGENT_STEPS.length - 1 ? "pb-7" : "pb-0"
                        )}
                      >
                        {/* Circle indicator */}
                        <div
                          className={cn(
                            "relative z-10 flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center border-[1.5px] transition-all duration-500 mt-0.5"
                          )}
                          style={{
                            borderColor: isActive
                              ? AccentColor
                              : isPast
                              ? "#10b981"
                              : "rgba(15,23,42,0.12)",
                            background: isActive
                              ? `${AccentColor}14`
                              : isPast
                              ? "rgba(16,185,129,0.1)"
                              : "rgba(15,23,42,0.03)",
                            boxShadow: isActive
                              ? `0 0 14px ${AccentColor}35`
                              : undefined,
                          }}
                        >
                          {isPast ? (
                            <Check className="size-3 text-emerald-400" strokeWidth={2.5} />
                          ) : isActive ? (
                            <motion.div
                              animate={{ scale: [1, 1.25, 1] }}
                              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                              className="w-2 h-2 rounded-full"
                              style={{ background: AccentColor }}
                            />
                          ) : (
                            <Icon className="size-3 text-slate-400" />
                          )}
                        </div>

                        {/* Text content */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <span
                            className={cn(
                              "block text-[15px] font-semibold tracking-tight transition-colors duration-300 leading-snug",
                              isActive
                                ? "text-[#1d1d1f]"
                                : isPast
                                ? "text-emerald-600/80"
                                : "text-slate-400 group-hover:text-slate-600"
                            )}
                          >
                            {step.title}
                          </span>

                          <AnimatePresence mode="wait">
                            {isActive && (
                              <motion.p
                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                animate={{ opacity: 1, height: "auto", marginTop: 4 }}
                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                                className="text-[12.5px] text-[#6e6e73] leading-relaxed overflow-hidden"
                              >
                                {step.description}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Bottom progress bar */}
                <div className="px-8 pb-7 pt-0">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      Step {activeIndex + 1} / {AGENT_STEPS.length}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {AGENT_STEPS.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => handleTabClick(i)}
                          className={cn(
                            "h-[3px] rounded-full transition-all duration-500 focus:outline-none",
                            i === activeIndex ? "w-6" : i < activeIndex ? "w-2" : "w-2"
                          )}
                          style={{
                            background:
                              i === activeIndex
                                ? AccentColor
                                : i < activeIndex
                                ? "#10b981"
                                : "rgba(15,23,42,0.12)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="h-[2px] rounded-full bg-black/[0.07] overflow-hidden">
                    <motion.div
                      key={`bar-${activeIndex}`}
                      className="h-full rounded-full origin-left"
                      style={{ background: AccentColor }}
                      initial={{ scaleX: 0 }}
                      animate={isPaused ? {} : { scaleX: 1 }}
                      transition={{ duration: AUTO_PLAY_DURATION / 1000, ease: "linear" }}
                    />
                  </div>
                </div>
              </div>

              {/* ── RIGHT COLUMN: Visual + Terminal ── */}
              <div
                className="lg:col-span-7 relative overflow-hidden bg-black"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                {/* Background image */}
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                  <motion.img
                    key={activeIndex}
                    src={currentStep.image}
                    alt={currentStep.title}
                    custom={direction}
                    variants={imageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      y: { type: "spring", stiffness: 180, damping: 26 },
                      opacity: { duration: 0.35 },
                      scale: { duration: 0.5 },
                    }}
                    className="absolute inset-0 w-full h-full object-cover opacity-[0.22]"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                </AnimatePresence>

                {/* Vignette */}
                <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/70 pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

                {/* Tag pill */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`tag-${activeIndex}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.25 }}
                    className="absolute top-5 left-5 z-10"
                  >
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border"
                      style={{
                        color: currentStep.accent,
                        borderColor: `${currentStep.accent}25`,
                        background: `${currentStep.accent}0d`,
                      }}
                    >
                      {currentStep.tag}
                    </span>
                  </motion.div>
                </AnimatePresence>

                {/* Terminal panel */}
                <div className="absolute bottom-5 left-5 right-5 z-10">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`terminal-${activeIndex}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="rounded-xl border border-white/[0.07] overflow-hidden"
                      style={{ background: "rgba(8, 8, 11, 0.82)", backdropFilter: "blur(16px)" }}
                    >
                      {/* Terminal title bar */}
                      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.05]">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500/35" />
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/35" />
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/35" />
                        </div>
                        <span className="text-[10px] text-white/20 font-mono">
                          helix-agent · genome-pipeline
                        </span>
                        {/* Live indicator */}
                        <div className="ml-auto flex items-center gap-1.5">
                          <motion.div
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ repeat: Infinity, duration: 1.4 }}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: currentStep.accent }}
                          />
                          <span className="text-[10px] font-mono" style={{ color: currentStep.accent }}>
                            LIVE
                          </span>
                        </div>
                      </div>

                      {/* Terminal output */}
                      <div className="px-4 py-3 font-mono min-h-[90px] flex flex-col justify-end gap-1.5">
                        {currentStep.details.slice(0, visibleLines).map((line, i) => {
                          const isLast = i === visibleLines - 1;
                          const isDone = i === currentStep.details.length - 1 && visibleLines === currentStep.details.length;
                          return (
                            <motion.div
                              key={`${activeIndex}-line-${i}`}
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.18 }}
                              className="flex items-center gap-2 text-[12px]"
                            >
                              <span className="opacity-40 select-none" style={{ color: currentStep.accent }}>
                                {isDone ? "✓" : isLast ? "›" : "·"}
                              </span>
                              <span
                                className={cn(
                                  "transition-colors duration-300",
                                  isDone
                                    ? "text-emerald-400"
                                    : isLast
                                    ? "text-white/80"
                                    : "text-white/30"
                                )}
                              >
                                {line}
                              </span>
                            </motion.div>
                          );
                        })}

                        {/* Blinking cursor while loading */}
                        {visibleLines < currentStep.details.length && (
                          <div className="flex items-center gap-2 text-[12px]">
                            <span className="opacity-40" style={{ color: currentStep.accent }}>›</span>
                            <motion.span
                              animate={{ opacity: [1, 0, 1] }}
                              transition={{ repeat: Infinity, duration: 0.75 }}
                              className="inline-block w-1.5 h-3.5 rounded-sm"
                              style={{ background: currentStep.accent, opacity: 0.7 }}
                            />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
