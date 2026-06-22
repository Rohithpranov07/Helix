"use client";

import * as React from "react";
import { motion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";
import { BlurTextEffect } from "@/components/ui/blur-text-effect";

// Prop definition for the component
interface GrowthHeroSectionProps {
  /** The main title, can include <br /> for line breaks */
  title: React.ReactNode;
  /** The first paragraph of description text */
  description1: string;
  /** The second paragraph of description text */
  description2: string;
  /** An array of 4 image source URLs for the staged illustration */
  images: [string, string, string, string];
  /** Call-to-action details */
  cta: {
    text: string;
    href: string;
  };
  /** Optional brand / eyebrow label to display at the top */
  brandName?: string;
  /** Optional className to override styles */
  className?: string;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * A responsive hero section with a staged image gallery that reveals on scroll.
 * Themed for the HELIX dark dashboard (near-black surface, blue genome accent).
 */
export const GrowthHeroSection = ({
  title,
  description1,
  description2,
  images,
  cta,
  brandName,
  className,
}: GrowthHeroSectionProps) => {
  // Container orchestrates the staggered reveal of its image children
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.18,
        delayChildren: 0.15,
      },
    },
  };

  // Each image rises and fades into place
  const itemVariants: Variants = {
    hidden: { y: 24, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6, ease: EASE },
    },
  };

  return (
    <section
      className={cn(
        "relative w-full text-[#1d1d1f] antialiased",
        className
      )}
      style={{ background: "linear-gradient(180deg, #f6efe2 0%, #f1e9da 100%)" }}
    >
      <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 text-center">
        {/* Optional eyebrow / brand label */}
        {brandName && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="absolute top-10 font-mono text-[11px] uppercase tracking-[0.42em] text-[#2f8fe0]"
          >
            {brandName}
          </motion.div>
        )}

        {/* Staged illustration row — staggers in as the section scrolls into view */}
        <motion.div
          className="mb-10 flex items-end justify-center gap-5 sm:gap-8 md:gap-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          aria-label="Stages of the HELIX genome lifecycle"
        >
          {images.map((src, index) => (
            <motion.div key={index} variants={itemVariants}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Genome lifecycle illustration ${index + 1}`}
                className="h-auto max-h-[116px] w-auto rounded-2xl ring-1 ring-black/10 shadow-[0_12px_28px_-16px_rgba(15,23,42,0.3)]"
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Main Title */}
        <motion.h1
          className="mb-6 max-w-3xl text-3xl font-semibold tracking-tight text-[#1d1d1f] md:text-5xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
        >
          {title}
        </motion.h1>

        {/* Description Paragraphs */}
        <motion.div
          className="max-w-2xl space-y-4 text-base leading-relaxed text-[#5b5650] md:text-lg"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
        >
          <p>
            <BlurTextEffect>{description1}</BlurTextEffect>
          </p>
          <p>
            <BlurTextEffect>{description2}</BlurTextEffect>
          </p>
        </motion.div>

        {/* Call to Action Link */}
        <motion.a
          href={cta.href}
          className="mt-12 text-sm font-medium text-[#2f8fe0] underline-offset-4 transition-colors hover:text-[#1d4ed8] hover:underline"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.65, ease: EASE }}
          aria-label={cta.text}
        >
          {cta.text}
        </motion.a>
      </div>
    </section>
  );
};
