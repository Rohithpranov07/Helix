"use client";

import * as React from "react";
import { motion } from "motion/react";
import useEmblaCarousel from "embla-carousel-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

// ── Inline SVG slide images ────────────────────────────────────────────────

type SlideImageOpts = {
  title: string;
  icon: string;
  startColor: string;
  endColor: string;
  accent: string;
};

function makeSvg({ title, icon, startColor, endColor, accent }: SlideImageOpts) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="680" viewBox="0 0 1200 680" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="680" gradientUnits="userSpaceOnUse">
      <stop stop-color="${startColor}"/>
      <stop offset="1" stop-color="${endColor}"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="680" fill="url(#bg)"/>
  <!-- grid lines -->
  <line x1="0" y1="170" x2="1200" y2="170" stroke="${accent}" stroke-opacity="0.08" stroke-width="1"/>
  <line x1="0" y1="340" x2="1200" y2="340" stroke="${accent}" stroke-opacity="0.08" stroke-width="1"/>
  <line x1="0" y1="510" x2="1200" y2="510" stroke="${accent}" stroke-opacity="0.08" stroke-width="1"/>
  <line x1="300" y1="0" x2="300" y2="680" stroke="${accent}" stroke-opacity="0.08" stroke-width="1"/>
  <line x1="600" y1="0" x2="600" y2="680" stroke="${accent}" stroke-opacity="0.08" stroke-width="1"/>
  <line x1="900" y1="0" x2="900" y2="680" stroke="${accent}" stroke-opacity="0.08" stroke-width="1"/>
  <!-- glow orb -->
  <ellipse cx="600" cy="340" rx="320" ry="220" fill="${accent}" fill-opacity="0.13"/>
  <!-- centre icon box -->
  <rect x="490" y="224" width="220" height="220" rx="40" fill="${accent}" fill-opacity="0.18"/>
  <rect x="490" y="224" width="220" height="220" rx="40" stroke="${accent}" stroke-opacity="0.35" stroke-width="1.5"/>
  <text x="600" y="365" fill="${accent}" font-family="Arial" font-size="80" text-anchor="middle" dominant-baseline="middle">${icon}</text>
  <!-- label bar -->
  <rect x="340" y="480" width="520" height="44" rx="22" fill="${accent}" fill-opacity="0.14"/>
  <text x="600" y="508" fill="${accent}" font-family="Arial, sans-serif" font-size="22" font-weight="600" text-anchor="middle" dominant-baseline="middle">${title}</text>
  <!-- corner dots -->
  <circle cx="120" cy="120" r="6" fill="${accent}" fill-opacity="0.4"/>
  <circle cx="1080" cy="120" r="6" fill="${accent}" fill-opacity="0.4"/>
  <circle cx="120" cy="560" r="6" fill="${accent}" fill-opacity="0.4"/>
  <circle cx="1080" cy="560" r="6" fill="${accent}" fill-opacity="0.4"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ── Slide data — HELIX organs ──────────────────────────────────────────────

const SLIDES = [
  {
    id: "genome",
    icon: "🧬",
    title: "Genome — Intent Alignment",
    heading: "Your code, anchored to intent",
    body: "HELIX reads your repository and builds an Intent Strand for every module — purpose, invariants, edge decisions. When a commit breaks an invariant, Genome surfaces the drift before it becomes a bug.",
    startColor: "#030a06",
    endColor: "#061a0e",
    accent: "#22c55e",
  },
  {
    id: "immune",
    icon: "🛡️",
    title: "Immune System — Auto-Heal",
    heading: "Vulnerabilities found and healed — not just flagged",
    body: "The Immune System scans for SQLi, XSS, auth bypasses, and secret leaks. Every confirmed exploit is patched inside the Shadow twin, re-attacked to verify closure, and minted as a permanent antibody.",
    startColor: "#080010",
    endColor: "#130520",
    accent: "#a855f7",
  },
  {
    id: "metabolism",
    icon: "🌡️",
    title: "Metabolism — Entropy Watch",
    heading: "Know when your codebase is warming up",
    body: "Metabolism measures duplication, coupling, pattern variance, and comprehension daily — computing a Temperature (0–100°). At 70° you get warnings. At 100° HELIX triggers a consolidation enzyme before the rewrite cliff.",
    startColor: "#0a0600",
    endColor: "#1a0a00",
    accent: "#f59e0b",
  },
  {
    id: "reflex",
    icon: "💓",
    title: "Resurrection Reflex — Midnight Saves",
    heading: "Crashed at 3 AM? Already rolled back",
    body: "The Nervous System watches every deploy. On divergence it auto-rolls back in seconds, reconstructs the causal chain, verifies a fix in Shadow, promotes it, and mints an antibody — while you sleep.",
    startColor: "#080000",
    endColor: "#160500",
    accent: "#ef4444",
  },
] as const;

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  repoName: string | undefined;
  onComplete: (() => void) | undefined;
}

export function OnboardingDialog({ repoName, onComplete }: Props) {
  const router = useRouter();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActiveIndex(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  const isFirst = activeIndex === 0;
  const isLast = activeIndex === SLIDES.length - 1;
  const current = SLIDES[activeIndex] ?? SLIDES[0];

  const handleNext = () => {
    if (isLast) {
      if (onComplete) {
        onComplete();
      } else {
        router.push("/dashboard");
      }
      return;
    }
    emblaApi?.scrollNext();
  };

  const handleSkip = () => {
    if (onComplete) {
      onComplete();
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-[#0d0f1a] border border-white/10 shadow-2xl overflow-hidden">
        <div className="p-4">

          {/* Slide image carousel */}
          <div ref={emblaRef} className="overflow-hidden rounded-xl">
            <div className="flex">
              {SLIDES.map((slide) => (
                <div key={slide.id} className="flex-[0_0_100%] min-w-0">
                  <img
                    src={makeSvg({
                      title: slide.title,
                      icon: slide.icon,
                      startColor: slide.startColor,
                      endColor: slide.endColor,
                      accent: slide.accent,
                    })}
                    alt={slide.title}
                    className="aspect-video w-full rounded-xl object-cover"
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-2 mt-3">
            {SLIDES.map((slide, i) => (
              <motion.div
                key={slide.id}
                animate={{ opacity: i === activeIndex ? 1 : 0.35, width: i === activeIndex ? 24 : 8 }}
                initial={false}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="h-2 overflow-hidden"
              >
                <button
                  onClick={() => emblaApi?.scrollTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className="h-2 w-full rounded-full cursor-pointer"
                  style={{ background: i === activeIndex ? current.accent : "#334155" }}
                />
              </motion.div>
            ))}
          </div>

          {/* Text — stacked grid fade so height is stable */}
          <div className="grid mt-4 px-1 min-h-22">
            {SLIDES.map((slide) => (
              <motion.div
                key={slide.id}
                animate={{ opacity: current.id === slide.id ? 1 : 0 }}
                initial={false}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="col-start-1 row-start-1"
                style={{ pointerEvents: current.id === slide.id ? "auto" : "none" }}
              >
                {repoName && activeIndex === 0 && (
                  <p className="text-xs font-mono text-green-400 mb-1">
                    Connected: {repoName}
                  </p>
                )}
                <h2 className="text-base font-semibold text-white leading-snug">
                  {slide.heading}
                </h2>
                <p className="text-sm text-neutral-400 mt-1.5 leading-relaxed">
                  {slide.body}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-5 px-1 pb-1">
            <div>
              {!isFirst && (
                <button
                  onClick={() => emblaApi?.scrollPrev()}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-neutral-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                >
                  Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSkip}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-neutral-500 hover:bg-white/5 hover:text-neutral-300 transition-colors cursor-pointer"
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer",
                  isLast
                    ? "bg-green-600 hover:bg-green-500 text-white"
                    : "bg-white text-black hover:bg-neutral-200"
                )}
              >
                {isLast ? "Enter HELIX →" : "Next"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
