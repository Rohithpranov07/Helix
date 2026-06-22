"use client";

import * as React from "react";
import { motion } from "motion/react";

import {
  TableOfContents,
  TableOfContentsMobile,
  useScrollSpy,
  type TocItem,
} from "@/components/ui/table-of-contents";

const steps: Array<TocItem & { body: string; accent: string }> = [
  {
    id: "paste-repo",
    title: "1. Paste your repo",
    depth: 2,
    accent: "#CCFF00",
    body: "Drop a GitHub URL — like github.com/you/myapp — into the HELIX chat input above. It's parsed into owner/repo the moment you hit send.",
  },
  {
    id: "authorize-github",
    title: "2. Authorize GitHub",
    depth: 2,
    accent: "#7db8ff",
    body: "Click \"Authorize GitHub Access.\" HELIX requests the repo scope only — enough to read your code and open branches/PRs for healing patches, nothing more.",
  },
  {
    id: "first-scan",
    title: "3. First scan runs automatically",
    depth: 2,
    accent: "#FF8A65",
    body: "Once connected, onboarding kicks off a Genome index and drift check before you ever touch the dashboard — day one starts with a real picture of your repo.",
  },
  {
    id: "explore-organs",
    title: "4. Explore your organs",
    depth: 2,
    accent: "#FFD166",
    body: "Every organ gets its own dashboard view, all reachable from the sidebar.",
  },
  {
    id: "organ-genome",
    title: "Genome",
    depth: 3,
    accent: "#7db8ff",
    body: "Intent vs. code, side by side — see exactly where they've drifted.",
  },
  {
    id: "organ-immune",
    title: "Immune System",
    depth: 3,
    accent: "#B084FF",
    body: "Live vulnerability scans and the antibody library of everything HELIX has already learned to catch.",
  },
  {
    id: "organ-metabolism",
    title: "Metabolism",
    depth: 3,
    accent: "#FF8A65",
    body: "Entropy over time — dead code, drift, and decay, tracked as a living signal.",
  },
  {
    id: "organ-shadow",
    title: "Shadow",
    depth: 3,
    accent: "#9FB8FF",
    body: "Every healing patch proves itself against a shadow twin before it's allowed anywhere near production.",
  },
  {
    id: "quick-actions",
    title: "5. Or just ask",
    depth: 2,
    accent: "#CCFF00",
    body: "Skip the menus — the quick-action pills under the chat input (Analyze Security, Genome Drift, Immunity Report, Entropy Check) drop a ready-made prompt straight into the box.",
  },
];

const mainSteps = steps.filter((s) => s.depth === 2);

export function QuickStartGuide() {
  const [activeId, setActiveId] = React.useState<string | undefined>(steps[0]?.id);
  const spyId = useScrollSpy(steps.map((s) => s.id));

  React.useEffect(() => {
    if (spyId) {
      setActiveId(spyId);
    }
  }, [spyId]);

  const handleItemClick = React.useCallback((id: string) => {
    setActiveId(id);
  }, []);

  // Index of the active main step (3rd-depth items count toward their parent's
  // step number) — drives the floating "X / 5" progress badge.
  const activeStep = steps.find((s) => s.id === activeId);
  const activeMainIndex = activeStep
    ? mainSteps.findIndex((s) =>
        activeStep.depth === 2
          ? s.id === activeStep.id
          : steps.indexOf(s) <= steps.indexOf(activeStep),
      )
    : 0;
  const progressPct = ((Math.max(activeMainIndex, 0) + 1) / mainSteps.length) * 100;

  return (
    <div className="dark relative w-full overflow-hidden bg-[#0038FF] py-16 md:py-24 px-4">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff15_1px,transparent_1px),linear-gradient(to_bottom,#ffffff15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* Ambient glow blobs drifting slowly behind the panel */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-10 size-[28rem] rounded-full bg-[#CCFF00]/10 blur-[100px]"
        animate={{ x: [0, 40, 0], y: [0, 24, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 size-[24rem] rounded-full bg-[#7db8ff]/10 blur-[100px]"
        animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      <div className="relative mx-auto max-w-5xl">
        <motion.p
          initial={{ opacity: 0, y: 12, letterSpacing: "0.5em" }}
          whileInView={{ opacity: 1, y: 0, letterSpacing: "0.25em" }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mb-6 text-center text-xs font-medium uppercase tracking-[0.25em] text-[#CCFF00]"
        >
          Quick Start
        </motion.p>

        <TableOfContentsMobile
          items={steps}
          activeId={activeId}
          onItemClick={handleItemClick}
          className="md:hidden mb-4 rounded-2xl border border-white/15 bg-[#001A99]/40 [&_a]:text-white/55 [&_a[data-in-trail=true]]:text-white/90 [&_a[data-active=true]]:text-[#CCFF00] [&_a[data-active=true]]:font-semibold"
        />

        <div className="relative">
          {/* Floating progress badge */}
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.55 }}
            className="absolute -top-4 right-4 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-[#050a2e] px-3 py-1.5 shadow-lg md:-top-5 md:right-8"
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#CCFF00] opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-[#CCFF00]" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
              Step {Math.max(activeMainIndex, 0) + 1} / {mainSteps.length}
            </span>
          </motion.div>

          {/* Corner bracket accents — viewfinder framing */}
          {[
            "left-0 top-0 -translate-x-1.5 -translate-y-1.5 border-l-2 border-t-2",
            "right-0 top-0 translate-x-1.5 -translate-y-1.5 border-r-2 border-t-2",
            "left-0 bottom-0 -translate-x-1.5 translate-y-1.5 border-l-2 border-b-2",
            "right-0 bottom-0 translate-x-1.5 translate-y-1.5 border-r-2 border-b-2",
          ].map((pos, i) => (
            <motion.span
              key={pos}
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.06 }}
              className={`pointer-events-none absolute z-20 size-5 rounded-[3px] border-[#CCFF00]/70 ${pos}`}
            />
          ))}

          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.97, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="grid w-full grid-cols-1 overflow-hidden rounded-[2rem] border border-white/15 bg-[#0a1040]/80 backdrop-blur-md shadow-2xl md:grid-cols-[minmax(0,1fr)_240px]"
          >
          <article className="relative min-h-[480px] border-r border-white/10 p-7 md:p-9">
            {/* macOS-style window chrome */}
            <motion.div
              className="mb-8 flex items-center gap-2"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.6 }}
              transition={{ staggerChildren: 0.12, delayChildren: 0.25 }}
            >
              {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                <motion.span
                  key={c}
                  variants={{
                    hidden: { scale: 0, opacity: 0 },
                    show: { scale: 1, opacity: 1 },
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: c }}
                />
              ))}
              <motion.span
                variants={{
                  hidden: { opacity: 0, x: -6 },
                  show: { opacity: 1, x: 0 },
                }}
                className="ml-3 text-xs font-medium text-white/50"
              >
                Quick Start Guide
              </motion.span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-white"
            >
              From repo to alive
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.42 }}
              className="mt-3 max-w-lg text-sm leading-6 text-white/70"
            >
              Five steps from pasting a URL to a fully monitored,
              self-healing repository.
            </motion.p>

            <motion.div
              className="mt-7 space-y-3"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.1 }}
              transition={{ staggerChildren: 0.07, delayChildren: 0.35 }}
            >
              {steps.map((step) => {
                const active = step.id === activeId;
                return (
                  <motion.div
                    key={step.id}
                    variants={{
                      hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
                      show: {
                        opacity: 1,
                        y: 0,
                        filter: "blur(0px)",
                        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                      },
                    }}
                  >
                  <section
                    id={step.id}
                    className={
                      "scroll-mt-24 rounded-2xl border p-4 transition-all duration-500 " +
                      (active
                        ? "border-white/20 bg-white/[0.07] shadow-sm"
                        : "border-white/10 bg-white/[0.015] opacity-60")
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-1.5 rounded-full transition-colors duration-500"
                        style={{ backgroundColor: active ? step.accent : "rgba(255,255,255,0.3)" }}
                      />
                      {step.depth === 2 ? (
                        <h3 className="text-base font-semibold tracking-tight text-white">
                          {step.title}
                        </h3>
                      ) : (
                        <h4 className="text-sm font-semibold tracking-tight text-white/90">
                          {step.title}
                        </h4>
                      )}
                    </div>
                    <p className="mt-1.5 ml-3.5 text-xs leading-5 text-white/70">
                      {step.body}
                    </p>
                  </section>
                  </motion.div>
                );
              })}
            </motion.div>
          </article>

          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            className="hidden md:flex items-start justify-center bg-white/[0.03] p-6"
          >
            <div className="sticky top-6 w-full max-w-[220px] rounded-2xl border border-white/10 bg-[#0a1d6e]/60 p-4 shadow-sm">
              <TableOfContents
                items={steps}
                activeId={activeId}
                onItemClick={handleItemClick}
                className="[&_a]:py-0.5 [&_a]:pr-0 [&_a]:text-[0.72rem] [&_a]:leading-4 [&_a]:text-white/55 [&_a[data-in-trail=true]]:text-white/90 [&_a[data-active=true]]:text-[#CCFF00] [&_a[data-active=true]]:font-semibold"
              />
            </div>
          </motion.aside>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
