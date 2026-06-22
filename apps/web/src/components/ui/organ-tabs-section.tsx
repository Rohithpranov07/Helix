"use client";

import { motion } from "motion/react";
import { AnimatedTabs } from "@/components/ui/animated-tabs";

const organTabs = [
  {
    id: "genome",
    label: "Genome",
    content: (
      <div className="grid grid-cols-2 gap-6 w-full h-full">
        <img
          src="/dash-genome.jpg"
          loading="lazy"
          decoding="async"
          alt="Genome organ dashboard"
          className="rounded-xl w-full h-80 object-cover mt-0 m-0! shadow-[0_0_24px_rgba(0,0,0,0.25)] border border-white/10"
        />
        <div className="flex flex-col gap-y-3 justify-center">
          <h2 className="text-4xl font-bold mb-0 text-white mt-0 m-0!">
            Genome
          </h2>
          <p className="text-lg text-gray-200 mt-0 leading-relaxed">
            Your intent strand base-paired against the live codebase —
            catching drift between what you meant and what shipped.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "immune",
    label: "Immune System",
    content: (
      <div className="grid grid-cols-2 gap-6 w-full h-full">
        <img
          src="/dash-immune.jpg"
          loading="lazy"
          decoding="async"
          alt="Immune System organ dashboard"
          className="rounded-xl w-full h-80 object-cover mt-0 m-0! shadow-[0_0_24px_rgba(0,0,0,0.25)] border border-white/10"
        />
        <div className="flex flex-col gap-y-3 justify-center">
          <h2 className="text-4xl font-bold mb-0 text-white mt-0 m-0!">
            Immune System
          </h2>
          <p className="text-lg text-gray-200 mt-0 leading-relaxed">
            Every change scanned and matched against the antibody library —
            known threats neutralized on sight.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "shadow",
    label: "Shadow",
    content: (
      <div className="grid grid-cols-2 gap-6 w-full h-full">
        <img
          src="/dash-shadow.jpg"
          loading="lazy"
          decoding="async"
          alt="Shadow organ dashboard"
          className="rounded-xl w-full h-80 object-cover mt-0 m-0! shadow-[0_0_24px_rgba(0,0,0,0.25)] border border-white/10"
        />
        <div className="flex flex-col gap-y-3 justify-center">
          <h2 className="text-4xl font-bold mb-0 text-white mt-0 m-0!">
            Shadow
          </h2>
          <p className="text-lg text-gray-200 mt-0 leading-relaxed">
            Every healing patch proves itself against a shadow twin before
            it's ever allowed near production.
          </p>
        </div>
      </div>
    ),
  },
];

export function OrganTabsSection() {
  return (
    <section className="relative w-full overflow-hidden bg-[#0038FF] py-16 md:py-24 px-4 flex flex-col items-center">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff15_1px,transparent_1px),linear-gradient(to_bottom,#ffffff15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* Ambient glow blobs drifting slowly behind the tabs */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-28 top-1/4 size-[26rem] rounded-full bg-[#CCFF00]/10 blur-[100px]"
        animate={{ x: [0, 36, 0], y: [0, -22, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 bottom-0 size-[26rem] rounded-full bg-[#B084FF]/10 blur-[100px]"
        animate={{ x: [0, -30, 0], y: [0, 26, 0] }}
        transition={{ duration: 17, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      />

      <div className="relative w-full max-w-3xl text-center mb-10">
        <motion.p
          initial={{ opacity: 0, y: 12, letterSpacing: "0.5em" }}
          whileInView={{ opacity: 1, y: 0, letterSpacing: "0.25em" }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-xs font-medium uppercase tracking-[0.25em] text-[#CCFF00]"
        >
          Inside the organism
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="mt-3 text-4xl md:text-5xl font-black uppercase tracking-tighter text-white"
        >
          Pick an organ
        </motion.h2>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 0 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ staggerChildren: 0.12, delayChildren: 0.3 }}
        className="relative w-full max-w-3xl"
      >
        {/* Corner bracket accents — viewfinder framing, echoes "scan" theme */}
        {[
          "left-0 top-0 -translate-x-2 -translate-y-2 border-l-2 border-t-2",
          "right-0 top-0 translate-x-2 -translate-y-2 border-r-2 border-t-2",
          "left-0 bottom-0 -translate-x-2 translate-y-2 border-l-2 border-b-2",
          "right-0 bottom-0 translate-x-2 translate-y-2 border-r-2 border-b-2",
        ].map((pos, i) => (
          <motion.span
            key={pos}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.4, delay: 0.35 + i * 0.07 }}
            className={`pointer-events-none absolute z-20 size-5 rounded-[3px] border-[#CCFF00]/70 ${pos}`}
          />
        ))}

        <motion.div
          initial={{ opacity: 0, y: 36, scale: 0.97, filter: "blur(10px)" }}
          whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        >
          <AnimatedTabs tabs={organTabs} className="relative max-w-3xl" />
        </motion.div>
      </motion.div>
    </section>
  );
}
