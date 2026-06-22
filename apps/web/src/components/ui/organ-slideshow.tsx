"use client"

import { motion } from "motion/react"
import {
  HoverSlider,
  HoverSliderImage,
  HoverSliderImageWrap,
  TextStaggerHover,
} from "@/components/ui/animated-slideshow"

function OrganBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* corner brackets, matching the hero HUD */}
      <span className="absolute top-6 left-6 h-6 w-6 border-t border-l border-white/25" />
      <span className="absolute top-6 right-6 h-6 w-6 border-t border-r border-white/25" />
      <span className="absolute bottom-6 left-6 h-6 w-6 border-b border-l border-white/25" />
      <span className="absolute bottom-6 right-6 h-6 w-6 border-b border-r border-white/25" />

      {/* HUD readouts */}
      <div className="absolute top-10 left-10 font-mono text-[10px] tracking-[0.2em] text-white/35 leading-relaxed">
        <div>SYS://ORGAN_MAP</div>
        <div>NODES&nbsp;05</div>
      </div>
      <div className="absolute top-10 right-10 text-right font-mono text-[10px] tracking-[0.2em] text-white/35 leading-relaxed">
        <div>STATUS: SYNCED</div>
        <div>ENTROPY&nbsp;NOMINAL</div>
      </div>
      <div className="absolute bottom-10 right-10 font-mono text-[10px] tracking-[0.2em] text-white/35">
        ORGAN_SYNC: ACTIVE
      </div>
    </div>
  )
}

const ORGANS = [
  {
    id: "genome",
    title: "genome",
    imageUrl: "/dash-genome.jpg",
  },
  {
    id: "immune",
    title: "immune system",
    imageUrl: "/dash-immune.jpg",
  },
  {
    id: "metabolism",
    title: "metabolism",
    imageUrl: "/dash-metabolism.jpg",
  },
  {
    id: "reflex",
    title: "nervous system",
    imageUrl: "/dash-reflex.jpg",
  },
  {
    id: "shadow",
    title: "shadow",
    imageUrl: "/dash-shadow.jpg",
  },
]

export function OrganSlideshow() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative w-full min-h-screen overflow-hidden text-white"
    >
      <OrganBackdrop />

      <HoverSlider className="relative z-10 min-h-screen place-content-center p-6 md:px-12">
        <h3 className="mb-6 text-xs font-medium uppercase tracking-[0.45em] text-[rgba(180,210,255,0.6)]">
          / the organs
        </h3>
        <div className="flex flex-wrap items-center justify-evenly gap-6 md:gap-12">
          <div className="flex flex-col space-y-2 md:space-y-4">
            {ORGANS.map((organ, index) => (
              <TextStaggerHover
                key={organ.id}
                index={index}
                className="cursor-pointer text-4xl font-bold uppercase tracking-tighter text-white"
                text={organ.title}
              />
            ))}
          </div>
          <HoverSliderImageWrap className="rounded-lg border border-[rgba(120,170,255,0.25)] shadow-[0_0_40px_rgba(80,140,255,0.25)]">
            {ORGANS.map((organ, index) => (
              <div key={organ.id}>
                <HoverSliderImage
                  index={index}
                  imageUrl={organ.imageUrl}
                  src={organ.imageUrl}
                  alt={organ.title}
                  className="size-full max-h-96 object-cover"
                  loading="eager"
                  decoding="async"
                />
              </div>
            ))}
          </HoverSliderImageWrap>
        </div>
      </HoverSlider>
    </motion.section>
  )
}
