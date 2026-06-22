"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect } from "react"
import { motion, type Variants } from "motion/react"

const previewData = {
  genome: {
    image: "/dash-genome.jpg",
    title: "Genome",
    subtitle: "Intent vs. code, base-paired continuously",
  },
  immune: {
    image: "/dash-immune.jpg",
    title: "Immune System",
    subtitle: "Live scans matched against the antibody library",
  },
  shadow: {
    image: "/dash-shadow.jpg",
    title: "Shadow",
    subtitle: "Every patch proven before it touches production",
  },
}

const styles = `
  .hover-preview-container {
    min-height: 100vh;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    font-family: var(--font-sans, sans-serif);
    overflow-x: hidden;
    position: relative;
  }

  .hover-preview-container::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    opacity: 0.03;
    pointer-events: none;
    z-index: 9999;
  }

  .hover-preview-grid {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image:
      linear-gradient(to right, #ffffff15 1px, transparent 1px),
      linear-gradient(to bottom, #ffffff15 1px, transparent 1px);
    background-size: 64px 64px;
    pointer-events: none;
    z-index: 0;
  }

  .ambient-glow {
    position: fixed;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(80, 140, 255, 0.1) 0%, transparent 70%);
    pointer-events: none;
    z-index: -1;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation: pulse 8s ease-in-out infinite;
  }

  .ambient-glow-green {
    position: fixed;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(204, 255, 0, 0.08) 0%, transparent 70%);
    pointer-events: none;
    z-index: -1;
    top: 35%;
    left: 65%;
    transform: translate(-50%, -50%);
    animation: pulse 8s ease-in-out infinite;
    animation-delay: 2s;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
    50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.1); }
  }

  .content-container {
    position: relative;
    z-index: 1;
    max-width: 900px;
    width: 100%;
  }

  .text-block {
    font-size: clamp(1.5rem, 4vw, 2.5rem);
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.75);
    font-weight: 400;
    letter-spacing: -0.02em;
  }

  .text-block p {
    margin-bottom: 1.5em;
  }

  .hover-link {
    color: #CCFF00;
    font-weight: 700;
    cursor: pointer;
    position: relative;
    display: inline-block;
    transition: color 0.3s ease;
  }

  .hover-link::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 0;
    height: 2px;
    background: linear-gradient(90deg, #7db8ff, #CCFF00);
    transition: width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  .hover-link:hover {
    color: #fff;
  }

  .hover-link:hover::after {
    width: 100%;
  }

  .preview-card {
    position: fixed;
    pointer-events: none;
    z-index: 1000;
    opacity: 0;
    transform: translateY(10px) scale(0.95);
    transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    will-change: transform, opacity;
  }

  .preview-card.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .preview-card-inner {
    background: #0d1726;
    border-radius: 16px;
    padding: 8px;
    box-shadow:
      0 25px 50px -12px rgba(0, 0, 0, 0.8),
      0 0 0 1px rgba(255, 255, 255, 0.1),
      0 0 60px rgba(80, 140, 255, 0.15),
      0 0 30px rgba(204, 255, 0, 0.08);
    overflow: hidden;
    backdrop-filter: blur(10px);
  }

  .preview-card img {
    width: 280px;
    height: auto;
    border-radius: 10px;
    display: block;
  }

  .preview-card-title {
    padding: 12px 8px 8px;
    font-size: 0.85rem;
    color: #fff;
    font-weight: 600;
  }

  .preview-card-subtitle {
    padding: 0 8px 8px;
    font-size: 0.75rem;
    color: #8a96b8;
  }
`

// Each word slides up out of a clipped box, staggered by its position in the
// overall passage — flows as one continuous cascading wave across both lines
// (and through the hover-link words), rather than the whole block fading at once.
const wordVariants: Variants = {
  hidden: { y: "110%", opacity: 0 },
  show: (i: number) => ({
    y: "0%",
    opacity: 1,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: i * 0.026 },
  }),
}

const RevealWord = ({
  index,
  children,
}: {
  index: number
  children: React.ReactNode
}) => (
  // Outer span clips the slide; padding/negative-margin trick keeps descenders
  // (g, y, p) and the hover-link underline from getting cropped by the mask.
  <span
    style={{
      display: "inline-block",
      overflow: "hidden",
      verticalAlign: "bottom",
      paddingBottom: "0.2em",
      marginBottom: "-0.2em",
    }}
  >
    <motion.span custom={index} variants={wordVariants} style={{ display: "inline-block" }}>
      {children}
    </motion.span>
  </span>
)

type Token =
  | { type: "word"; text: string }
  | { type: "link"; key: string; text: string }

const words = (text: string): Token[] => text.split(" ").map((text) => ({ type: "word", text }))

const para1Tokens: Token[] = [
  ...words("See drift before it ships with"),
  { type: "link", key: "genome", text: "Genome" },
  ...words("base-pairing intent against your live codebase."),
]

const para2Tokens: Token[] = [
  ...words("Known threats are neutralized by the"),
  { type: "link", key: "immune", text: "Immune System" },
  ...words("on sight, and every healing patch proves itself in"),
  { type: "link", key: "shadow", text: "Shadow" },
  ...words("before it ever touches production."),
]

const renderTokens = (
  tokens: Token[],
  startIndex: number,
  handlers: {
    onHoverStart: (key: string, e: React.MouseEvent) => void
    onHoverMove: (e: React.MouseEvent) => void
    onHoverEnd: () => void
  },
) =>
  tokens.map((token, i) => (
    <span key={i}>
      <RevealWord index={startIndex + i}>
        {token.type === "word" ? (
          token.text
        ) : (
          <HoverLink previewKey={token.key} {...handlers}>
            {token.text}
          </HoverLink>
        )}
      </RevealWord>{" "}
    </span>
  ))

const HoverLink = ({
  previewKey,
  children,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}: {
  previewKey: string
  children: React.ReactNode
  onHoverStart: (key: string, e: React.MouseEvent) => void
  onHoverMove: (e: React.MouseEvent) => void
  onHoverEnd: () => void
}) => {
  return (
    <span
      className="hover-link"
      onMouseEnter={(e) => onHoverStart(previewKey, e)}
      onMouseMove={onHoverMove}
      onMouseLeave={onHoverEnd}
    >
      {children}
    </span>
  )
}

const PreviewCard = ({
  data,
  position,
  isVisible,
  cardRef,
}: {
  data: (typeof previewData)[keyof typeof previewData] | null
  position: { x: number; y: number }
  isVisible: boolean
  cardRef: React.RefObject<HTMLDivElement | null>
}) => {
  if (!data) return null

  return (
    <div
      ref={cardRef}
      className={`preview-card ${isVisible ? "visible" : ""}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="preview-card-inner">
        <img
          src={data.image || "/placeholder.svg"}
          alt={data.title || ""}
        />
        <div className="preview-card-title">{data.title}</div>
        <div className="preview-card-subtitle">{data.subtitle}</div>
      </div>
    </div>
  )
}

export function HoverPreview() {
  const [activePreview, setActivePreview] = useState<(typeof previewData)[keyof typeof previewData] | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isVisible, setIsVisible] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Preload all images on mount
  useEffect(() => {
    Object.entries(previewData).forEach(([, data]) => {
      const img = new Image()
      img.src = data.image
    })
  }, [])

  const updatePosition = useCallback((e: React.MouseEvent | MouseEvent) => {
    const cardWidth = 300
    const cardHeight = 250 // Approximate card height
    const offsetY = 20 // Gap between cursor and card bottom

    // Position card so its bottom-left is above the cursor
    let x = e.clientX - cardWidth / 2 // Center horizontally on cursor
    let y = e.clientY - cardHeight - offsetY // Position above cursor

    // Boundary checks - keep card on screen
    if (x + cardWidth > window.innerWidth - 20) {
      x = window.innerWidth - cardWidth - 20
    }
    if (x < 20) {
      x = 20
    }

    // If card would go above viewport, position below cursor instead
    if (y < 20) {
      y = e.clientY + offsetY
    }

    setPosition({ x, y })
  }, [])

  const handleHoverStart = useCallback(
    (key: string, e: React.MouseEvent) => {
      setActivePreview(previewData[key as keyof typeof previewData])
      setIsVisible(true)
      updatePosition(e)
    },
    [updatePosition],
  )

  const handleHoverMove = useCallback(
    (e: React.MouseEvent) => {
      if (isVisible) {
        updatePosition(e)
      }
    },
    [isVisible, updatePosition],
  )

  const handleHoverEnd = useCallback(() => {
    setIsVisible(false)
  }, [])

  return (
    <>
      <style>{styles}</style>
      <div className="hover-preview-container">
        <div className="hover-preview-grid" />
        <div className="ambient-glow" />
        <div className="ambient-glow-green" />

        <div className="content-container">
          <motion.div
            className="text-block"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.35 }}
          >
            <p>
              {renderTokens(para1Tokens, 0, {
                onHoverStart: handleHoverStart,
                onHoverMove: handleHoverMove,
                onHoverEnd: handleHoverEnd,
              })}
            </p>

            <p>
              {renderTokens(para2Tokens, para1Tokens.length, {
                onHoverStart: handleHoverStart,
                onHoverMove: handleHoverMove,
                onHoverEnd: handleHoverEnd,
              })}
            </p>
          </motion.div>
        </div>

        <PreviewCard data={activePreview} position={position} isVisible={isVisible} cardRef={cardRef} />
      </div>
    </>
  )
}
