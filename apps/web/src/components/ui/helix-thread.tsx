"use client";

import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Builds one continuous, smooth ribbon path in REAL pixel coordinates for a
 * box of `w` x `h`, using a gentle cosine sway whose wavelength is tied to the
 * viewport height `vh` (so the waves stay broad and even no matter how tall the
 * wrapped section is). The path enters from off-screen left at the very top and
 * winds straight down to the bottom — a single stroke, never a tight zigzag.
 *
 * Coordinates are real pixels and the SVG viewBox is set to the same w x h, so
 * there is NO aspect-ratio distortion: the curve keeps its true round shape
 * instead of being smeared into straight diagonals.
 */
function buildRibbonPath(w: number, h: number, vh: number): string {
  if (w <= 0 || h <= 0) return "";

  const center = w * 0.5;
  const amp = w * 0.31; // swing reaches across the width without burying text
  const wavelength = Math.max(vh * 1.7, 700); // longer wave ~1.7 screens, gentler
  const k = (2 * Math.PI) / wavelength;

  // Phase-shifted sine. At y=0 the curve sits left-of-center AND already has a
  // down-right tangent (no vertical tangent), so an off-screen-left entry can
  // flow straight in without hooking back on itself.
  const phi = -0.3 * Math.PI;
  const x = (y: number) => center + amp * Math.sin(k * y + phi);
  const x0 = x(0); // ~0.225w (left of centre)
  const slope = amp * k * Math.cos(phi); // dx/dy at y=0, > 0

  // Sample densely enough for a smooth Catmull-Rom fit.
  const pts: Array<[number, number]> = [];

  // Lead-in: two points placed ON the wave's start tangent, extended up-left
  // off-screen. Because they're collinear with the curve's initial direction,
  // Catmull-Rom can't overshoot — the entry reads as one clean swoop, no knot.
  const leadX = -w * 0.18; // off the left edge
  const leadY = (leadX - x0) / slope; // negative; lands on the tangent line
  pts.push([leadX, leadY]);
  pts.push([(x0 + leadX) / 2, leadY / 2]);

  // Sample a little past the bottom so the tail runs off the page edge with no
  // floating end-cap — it just disappears below the closing block.
  const yEnd = h * 1.1;
  const step = Math.max(h / 120, 12);
  for (let y = 0; y <= yEnd; y += step) pts.push([x(y), y]);
  pts.push([x(yEnd), yEnd]);

  // Catmull-Rom -> cubic bezier for a continuous smooth curve.
  const n = pts.length;
  const at = (i: number): [number, number] =>
    pts[Math.min(Math.max(i, 0), n - 1)] as [number, number];

  const first = at(0);
  let d = `M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

/**
 * One continuous green thread that enters from off-screen left at the top of
 * the wrapped section and draws itself in as the user scrolls through it.
 *
 * It measures the wrapper's real size and generates the wave in pixels, so the
 * ribbon never distorts into scattered diagonals. The draw uses Framer Motion's
 * `pathLength` prop on its own (NOT paired with a manual `strokeDashoffset`,
 * which would tile the dash and split the stroke into disconnected segments) —
 * so it always reads as one unbroken, growing ribbon.
 *
 * Drop this around the exact range of sections the thread should span; it wires
 * its own scroll ref, so it works inside an async server component.
 */
export function HelixThread({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0, vh: 0 });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const measure = () => {
      setSize({
        w: el.offsetWidth,
        h: el.offsetHeight,
        vh: window.innerHeight,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // progress 0 when the section's top hits the viewport bottom (thread starts
  // appearing as "Pick an organ" scrolls into view); progress 1 when the
  // section's bottom passes the viewport top (fully drawn just after the FAQ).
  // 0 when the section's top enters the viewport bottom (thread starts as
  // "Pick an organ" appears); 1 when the section's bottom reaches the viewport
  // bottom — i.e. the moment the closing "helix" block is fully in view, so the
  // ribbon finishes drawing right as its tail tucks behind that block.
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start end", "end end"],
  });

  // Light spring just to take the edge off scroll jitter — kept very stiff /
  // low-mass so the ribbon tracks the scroll position tightly with no visible
  // trailing (the draw stays glued to where you've actually scrolled).
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 420,
    damping: 48,
    mass: 0.18,
    restDelta: 0.0005,
  });
  const pathLength = useTransform(smoothProgress, [0.05, 0.9], [0, 1]);

  // Soft fade-in at the head so it breathes on rather than snapping; stays at
  // full opacity through the end so the tail reads clearly behind the block.
  const opacity = useTransform(smoothProgress, [0, 0.05], [0, 1]);

  const d = buildRibbonPath(size.w, size.h, size.vh);

  // Thick ribbon scaled to the viewport width (matches the reference's heft),
  // clamped so it stays bold on small screens and never gets cartoonish on big.
  const strokeWidth = Math.min(Math.max(size.w * 0.038, 36), 80);

  return (
    <div ref={wrapperRef} className="relative">
      {children}

      {d && (
        <svg
          viewBox={`0 0 ${size.w} ${size.h}`}
          preserveAspectRatio="none"
          className={cn(
            "pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible",
            className,
          )}
          aria-hidden="true"
        >
          <motion.path
            d={d}
            fill="none"
            stroke="#CCFF00"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              pathLength,
              opacity,
              filter: "drop-shadow(0 0 28px rgba(204,255,0,0.5))",
            }}
          />
        </svg>
      )}
    </div>
  );
}
