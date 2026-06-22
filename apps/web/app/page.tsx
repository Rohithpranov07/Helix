"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import {
  motion, useScroll, useSpring, useTransform, useMotionTemplate, useReducedMotion,
} from "motion/react";
import { CosmicParallaxBg } from "@/components/ui/parallax-cosmic-background";
import { HudOverlay } from "@/components/ui/hud-overlay";
import { OrganSlideshow } from "@/components/ui/organ-slideshow";
import { FeatureCardCarousel } from "@/components/ui/feature-card-carousel";
import { CosmicBackdrop } from "@/components/ui/cosmic-backdrop";
import { Component as FooterTapedDesign } from "@/components/ui/footer-taped-design";

// Scroll-reveal wrapper — fades + rises a section as it enters the viewport
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 48, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-120px" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Shape-expand reveal — a circular clip-path grows from the top seam as the
// section scrolls into view, so the content blooms open out of the hero.
// (The lukebaffait circle-reveal used on the chat hero's white card panel.)
// A tinted panel + glowing top edge gives the expanding shape contrast against
// the dark cosmic backdrop so the reveal is actually visible.
function ScrollClipReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start start"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 55, damping: 28, mass: 0.9 });
  // Full coverage by the end (clamped) so no dark wedges linger in the corners.
  const radius = useTransform(progress, [0, 1], [16, 185], { clamp: true });
  const clipPath = useMotionTemplate`circle(${radius}% at 50% 0%)`;

  if (reduce) return <div ref={ref}>{children}</div>;

  return (
    <div ref={ref} className="relative">
      <motion.div
        style={{ clipPath, WebkitClipPath: clipPath, willChange: "clip-path" }}
        className="relative overflow-hidden"
      >
        {/* Tinted panel behind the (transparent) section — gives the expanding
            shape a surface that reads against the near-black hero. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background: "linear-gradient(180deg, #0c1a3a 0%, #060a16 45%, #04070e 100%)",
            boxShadow: "0 -30px 80px -20px rgba(60,110,230,0.35)",
          }}
        />
        {/* Bright top edge — the leading rim of the expanding shape */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px z-20"
          style={{ background: "linear-gradient(90deg, transparent, rgba(140,180,255,0.8), transparent)" }}
        />
        {children}
      </motion.div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="relative w-full">
      <CosmicBackdrop />

      <div className="relative w-full h-screen overflow-hidden">
        <CosmicParallaxBg
          head="HELIX"
          text="Secure, Self-Healing, Alive, Immortal"
          loop={true}
        />

        <HudOverlay />

        {/* Get Started button — anchored to sphere surface below subtitle */}
        <div className="absolute inset-0 z-10 flex items-end justify-center pb-[5%] pointer-events-none">
          <motion.button
            onClick={() => router.push("/login")}
            className="pointer-events-auto group relative px-8 py-3 text-xs font-semibold tracking-[0.25em] uppercase text-white/90 transition-all duration-300"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            {/* border ring */}
            <span className="absolute inset-0 rounded-full border border-white/20 group-hover:border-white/40 transition-colors duration-300" />
            {/* glow fill on hover */}
            <span className="absolute inset-0 rounded-full bg-white/0 group-hover:bg-white/[0.06] transition-colors duration-300" />
            <span className="relative">Get Started →</span>
          </motion.button>
        </div>
      </div>

      <ScrollClipReveal>
        <OrganSlideshow />
      </ScrollClipReveal>
      <ScrollClipReveal>
        <FeatureCardCarousel />
      </ScrollClipReveal>

      <Reveal>
        <div className="relative z-10 px-4 pb-8">
          <FooterTapedDesign />
        </div>
      </Reveal>
    </div>
  );
}
