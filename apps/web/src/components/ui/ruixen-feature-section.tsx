"use client"

import { cn } from "@/lib/utils"
import { CardContent } from "@/components/ui/card"
import { Copy, Shuffle, Link2, ShieldAlert, Brain, Flame, Thermometer, Activity } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { motion, type MotionStyle } from "framer-motion"

const INK = "#18181b"
const ACCENT = { emerald: "#059669", red: "#dc2626", blue: "#2563eb", amber: "#d97706" }

export const Highlight = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => {
  return (
    <span
      className={cn("font-bold px-1 py-0.5 rounded-sm", className)}
      style={{ background: `${ACCENT.amber}22`, color: ACCENT.amber }}
    >
      {children}
    </span>
  )
}

// Narrated straight from the entropy organ's own findings — each card maps to
// one of the five EntropyDims and the enzyme that would act on it.
const CARDS = [
  {
    id: 0,
    name: "Duplication",
    designation: "Consolidator enzyme · 41%",
    accent: ACCENT.blue,
    content: (
      <p>
        <Highlight>Duplication</Highlight> climbed to 41% across three service modules. The consolidator enzyme can fold repeated logic into{" "}
        <Highlight>shared utilities without touching call sites</Highlight>.
      </p>
    ),
  },
  {
    id: 1,
    name: "Pattern Variance",
    designation: "Normaliser enzyme · 33%",
    accent: ACCENT.amber,
    content: (
      <p>
        <Highlight>Pattern Variance</Highlight> flags five different error-handling styles in the same package. The normaliser enzyme aligns them to{" "}
        <Highlight>one shared convention</Highlight>.
      </p>
    ),
  },
  {
    id: 2,
    name: "Coupling",
    designation: "Annealer enzyme · 58%",
    accent: ACCENT.red,
    content: (
      <p>
        <Highlight>Coupling</Highlight> between billing and auth crossed the warming threshold. The annealer enzyme proposes{" "}
        <Highlight>a clean seam before it hardens</Highlight>.
      </p>
    ),
  },
]

// The five dimensions the organ actually measures — same keys as EntropyDims.
const dimensions = [
  { name: "Duplication", desc: "Repeated logic across modules, ripe for consolidation", Icon: Copy, color: ACCENT.blue },
  { name: "Pattern Variance", desc: "Inconsistent conventions for the same kind of problem", Icon: Shuffle, color: ACCENT.amber },
  { name: "Coupling", desc: "Modules that can no longer change independently", Icon: Link2, color: ACCENT.red },
  { name: "Vuln Density", desc: "Concentration of known weaknesses per file", Icon: ShieldAlert, color: ACCENT.emerald },
  { name: "Comprehension", desc: "How quickly a new reader could explain this code", Icon: Brain, color: ACCENT.blue },
]

function Eyebrow({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="mb-4 inline-flex items-center gap-2 self-start px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-[0.12em]"
      style={{ background: color, color: "#fff", border: `2px solid ${INK}` }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", flexShrink: 0 }} />
      {children}
    </span>
  )
}

// Floating background decoration — flat ink-outline icons drawn from this
// section's own domain (heat, pulse), slowly rotating/bobbing for ambient motion.
function FloatIcon({ Icon, style = {}, size = 64, duration = 14 }: { Icon: React.ElementType; style?: MotionStyle; size?: number; duration?: number }) {
  return (
    <motion.div
      aria-hidden
      className="absolute pointer-events-none"
      style={style}
      animate={{ y: [0, -10, 0], rotate: [0, 6, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    >
      <Icon size={size} strokeWidth={1.25} style={{ color: `${INK}14` }} />
    </motion.div>
  )
}

function RevealBlock({ delay = 0, className, style = {}, children }: { delay?: number; className?: string; style?: MotionStyle; children: React.ReactNode }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export default function RuixenSection() {
  return (
    <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 overflow-hidden">
      {/* Ambient decoration — keeps the section feeling alive even at rest */}
      <FloatIcon Icon={Flame} style={{ top: "4%", right: "2%" }} size={84} duration={12} />
      <FloatIcon Icon={Thermometer} style={{ bottom: "8%", left: "0%" }} size={64} duration={16} />

      {/* Section title */}
      <RevealBlock className="relative z-10 mb-10 sm:mb-12 flex flex-col items-center text-center">
        <span
          className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-[0.14em]"
          style={{ background: "#fff", color: INK, border: `2px solid ${INK}` }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: ACCENT.emerald }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: ACCENT.emerald }} />
          </span>
          Measuring Live
        </span>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight" style={{ color: INK }}>
          The Metabolism Engine
        </h2>
        <p className="mt-3 max-w-xl text-sm sm:text-base font-medium leading-relaxed" style={{ color: `${INK}88` }}>
          Every codebase generates entropy. HELIX measures it across five dimensions, scores it as a single temperature, and proposes the enzyme that brings it back down.
        </p>
      </RevealBlock>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Block */}
        <RevealBlock
          delay={0.08}
          className="flex flex-col items-start rounded-xl p-5 sm:p-7 lg:p-8"
          style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: `6px 6px 0px ${INK}` }}
        >
          <Eyebrow color={ACCENT.blue}>Live Entropy Findings</Eyebrow>

          {/* Card */}
          <div className="relative w-full mb-6 sm:mb-8">
            <CardStack items={CARDS} />
          </div>

          {/* Content */}
          <h3 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: INK }}>
            See Entropy Before It Compounds
          </h3>
          <p className="mt-2 text-sm sm:text-base leading-relaxed" style={{ color: `${INK}88` }}>
            Five dimensions, one temperature — measured automatically, with enzyme actions proposed the moment entropy starts to compound.
          </p>
        </RevealBlock>

        {/* Right Block */}
        <RevealBlock
          delay={0.16}
          className="flex flex-col items-start rounded-xl p-5 sm:p-7 lg:p-8"
          style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: `6px 6px 0px ${INK}` }}
        >
          <Eyebrow color={ACCENT.red}>Entropy Coverage</Eyebrow>

          <h3 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: INK }}>
            Five Dimensions, One Score
          </h3>
          <p className="mt-2 mb-6 text-sm sm:text-base leading-relaxed" style={{ color: `${INK}88` }}>
            Every run scores the repository across all five — track the one that matters most to your codebase.
          </p>

          <div
            className={cn(
              "group relative w-full inline-flex animate-rainbow cursor-default items-center justify-center rounded-2xl border-0 p-1 transition-colors [background-clip:padding-box,border-box,border-box] [background-origin:border-box] [border:calc(0.08*1rem)_solid_transparent]",
              // before styles — sweeps the temperature scale (green → amber → red), not a generic rainbow
              "before:absolute before:bottom-[6%] before:left-1/2 before:z-0 before:h-1/4 before:w-3/4 before:-translate-x-1/2 before:animate-rainbow before:bg-[linear-gradient(90deg,hsl(var(--color-1)),hsl(var(--color-2)),hsl(var(--color-3)),hsl(var(--color-4)),hsl(var(--color-5)))] before:bg-[length:200%] before:opacity-90 before:[filter:blur(calc(1.1*1rem))]",
            )}
          >
            {/* Dimension list */}
            <CardContent
              className="p-3 sm:p-4 lg:p-5 space-y-2.5 sm:space-y-3 rounded-xl z-10 w-full"
              style={{ background: "#fff", border: `2px solid ${INK}` }}
            >
              {dimensions.map((item, i) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.06, duration: 0.35 }}
                  whileHover={{ x: 3 }}
                  className="flex items-center justify-between gap-3 p-2 sm:p-2.5 rounded-lg"
                  style={{ border: `1.5px solid ${INK}1f` }}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                    <motion.div
                      whileHover={{ rotate: 8, scale: 1.08 }}
                      className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-md flex-shrink-0"
                      style={{ background: item.color, border: `2px solid ${INK}` }}
                    >
                      <item.Icon className="size-4" strokeWidth={2} style={{ color: "#fff" }} />
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold truncate" style={{ color: INK }}>{item.name}</p>
                      <p className="text-[11px] sm:text-xs truncate" style={{ color: `${INK}77` }}>{item.desc}</p>
                    </div>
                  </div>
                  <span
                    className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-md flex-shrink-0"
                    style={{ border: `2px solid ${INK}`, background: "#fff" }}
                    aria-label={`${item.name} tracked`}
                  >
                    <Flame className="size-3.5" style={{ color: ACCENT.red }} />
                  </span>
                </motion.div>
              ))}
            </CardContent>
          </div>
        </RevealBlock>
      </div>

      {/* Stats and Principle Section */}
      <div className="relative z-10 mt-5 grid gap-5 lg:grid-cols-2">
        <RevealBlock
          delay={0.22}
          className="flex flex-col justify-center rounded-xl p-5 sm:p-7"
          style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: `6px 6px 0px ${INK}` }}
        >
          <div className="mb-4 flex items-center gap-2">
            <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
              <Activity className="size-4" style={{ color: ACCENT.emerald }} />
            </motion.span>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: `${INK}77` }}>Live Reading</span>
          </div>
          <div className="grid grid-cols-3 gap-6 w-full text-center">
            <div className="space-y-1.5">
              <div className="text-3xl sm:text-4xl font-black tabular-nums" style={{ color: ACCENT.blue }}>5</div>
              <p className="text-xs sm:text-sm font-bold" style={{ color: `${INK}88` }}>Entropy Dimensions</p>
            </div>
            <div className="space-y-1.5">
              <div className="text-3xl sm:text-4xl font-black tabular-nums" style={{ color: ACCENT.amber }}>3</div>
              <p className="text-xs sm:text-sm font-bold" style={{ color: `${INK}88` }}>Enzyme Types</p>
            </div>
            <div className="space-y-1.5">
              <div className="text-3xl sm:text-4xl font-black tabular-nums" style={{ color: ACCENT.emerald }}>100%</div>
              <p className="text-xs sm:text-sm font-bold" style={{ color: `${INK}88` }}>Shadow-Proven</p>
            </div>
          </div>
        </RevealBlock>
        <RevealBlock
          delay={0.28}
          className="rounded-xl p-5 sm:p-7"
          style={{ background: INK, border: `2px solid ${INK}`, boxShadow: `6px 6px 0px ${INK}40` }}
        >
          <blockquote className="pl-4 sm:pl-5" style={{ borderLeft: `3px solid ${ACCENT.amber}` }}>
            <p className="text-sm sm:text-base leading-relaxed" style={{ color: "#f0ead8" }}>
              Entropy is the one number that summarizes every form of decay — duplication, drift, coupling, vulnerability density, and falling comprehension. Left unchecked, it doesn&rsquo;t stay constant. It compounds.
            </p>
            <cite className="mt-4 block text-[11px] font-extrabold uppercase tracking-[0.12em] not-italic" style={{ color: ACCENT.amber }}>
              Metabolism — Entropy Field
            </cite>
          </blockquote>
        </RevealBlock>
      </div>
    </section>
  )
}

type Card = {
  id: number
  name: string
  designation: string
  accent: string
  content: React.ReactNode
}

export const CardStack = ({
  items,
  offset,
  scaleFactor,
}: {
  items: Card[]
  offset?: number
  scaleFactor?: number
}) => {
  const CARD_OFFSET = offset || 10
  const SCALE_FACTOR = scaleFactor || 0.06
  const [cards, setCards] = useState<Card[]>(items)
  // Per-instance ref — a module-level variable would let two mounted
  // CardStacks (or a dev-mode double-mount) clobber each other's interval id.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    startFlipping()

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])
  const startFlipping = () => {
    intervalRef.current = setInterval(() => {
      setCards((prevCards: Card[]) => {
        const newArray = [...prevCards] // create a copy of the array
        newArray.unshift(newArray.pop()!) // move the last element to the front
        return newArray
      })
    }, 5000)
  }

  return (
    <div className="relative mx-auto h-52 w-full md:h-52 md:w-full my-2">
      {cards.map((card, index) => {
        return (
          <motion.div
            key={card.id}
            className="absolute h-52 w-full rounded-xl p-4 sm:p-5 flex flex-col justify-between"
            style={{
              transformOrigin: "top center",
              background: "#fff",
              border: `2px solid ${INK}`,
              borderLeftWidth: 5,
              borderLeftColor: card.accent,
              boxShadow: `7px 7px 0px ${INK}`,
            }}
            animate={{
              top: index * -CARD_OFFSET,
              scale: 1 - index * SCALE_FACTOR, // decrease scale for cards that are behind
              zIndex: cards.length - index, //  decrease z-index for the cards that are behind
            }}
          >
            <div className="text-[13px] sm:text-sm font-medium leading-relaxed" style={{ color: `${INK}cc` }}>
              {card.content}
            </div>
            <div>
              <p className="text-sm font-extrabold" style={{ color: INK }}>
                {card.name}
              </p>
              <p className="text-xs font-bold" style={{ color: card.accent }}>
                {card.designation}
              </p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
