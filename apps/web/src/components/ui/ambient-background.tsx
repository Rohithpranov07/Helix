"use client";

import { motion, useReducedMotion } from "motion/react";

// ── Mesh blob ────────────────────────────────────────────────────────────────
// One soft, heavily-blurred colour field that slowly drifts, scales and breathes.
// Several overlapping blobs form an organic "living" mesh gradient — motion is
// motivated: the slow drift is the visual metaphor for HELIX as a living system.
interface BlobProps {
  color: string;
  className: string;
  size: number;
  drift: [number, number];
  duration: number;
  delay?: number;
  reduce: boolean | null;
}

function MeshBlob({ color, className, size, drift, duration, delay = 0, reduce }: BlobProps) {
  return (
    <motion.div
      aria-hidden
      className={`absolute rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 70%)`,
        filter: "blur(72px)",
        willChange: "transform",
      }}
      {...(reduce
        ? {}
        : {
            animate: {
              x: [0, drift[0], drift[0] * 0.4, 0],
              y: [0, drift[1], drift[1] * 0.6, 0],
              scale: [1, 1.12, 0.96, 1],
            },
            transition: { duration, delay, repeat: Infinity, ease: "easeInOut" },
          })}
    />
  );
}

// ── Ambient background ───────────────────────────────────────────────────────
// Fixed, pointer-events-none decorative layer that sits above the cream base
// gradient and below page content. A premium animated mesh gradient: soft accent
// fields drifting slowly over warm cream, edges feathered with a radial mask so
// nothing reads as a hard shape.
export function AmbientBackground() {
  const reduce = useReducedMotion();

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        maskImage: "radial-gradient(130% 110% at 50% 30%, #000 55%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(130% 110% at 50% 30%, #000 55%, transparent 100%)",
      }}
    >
      {/* Emerald field — upper left */}
      <MeshBlob
        reduce={reduce}
        color="rgba(52,211,153,0.42)"
        className="-top-40 -left-40"
        size={620}
        drift={[120, 80]}
        duration={28}
      />
      {/* Violet field — upper right */}
      <MeshBlob
        reduce={reduce}
        color="rgba(167,139,250,0.42)"
        className="-top-52 right-[-12rem]"
        size={680}
        drift={[-130, 90]}
        duration={32}
        delay={1.5}
      />
      {/* Warm peach field — centre, the heart of the warmth */}
      <MeshBlob
        reduce={reduce}
        color="rgba(251,176,120,0.34)"
        className="top-[34%] left-[34%]"
        size={760}
        drift={[90, -110]}
        duration={36}
        delay={0.8}
      />
      {/* Sky field — mid left */}
      <MeshBlob
        reduce={reduce}
        color="rgba(125,211,252,0.30)"
        className="top-[52%] -left-44"
        size={560}
        drift={[110, -60]}
        duration={30}
        delay={2.4}
      />
      {/* Soft rose field — lower right */}
      <MeshBlob
        reduce={reduce}
        color="rgba(244,164,212,0.30)"
        className="bottom-[-12rem] right-[8%]"
        size={640}
        drift={[-90, -90]}
        duration={34}
        delay={1.1}
      />
    </div>
  );
}
