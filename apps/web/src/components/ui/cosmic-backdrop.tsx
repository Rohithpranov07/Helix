"use client"

import * as React from "react"

function generateStarBoxShadow(count: number): string {
  const shadows: string[] = []
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * 2000)
    const y = Math.floor(Math.random() * 2000)
    shadows.push(`${x}px ${y}px #FFF`)
  }
  return shadows.join(", ")
}

/**
 * Fixed, viewport-locked nebula + starfield. Renders once behind the whole
 * scrollable page so every section shows the exact same frame — eliminating
 * the seams that show up when each section paints its own background.
 */
export function CosmicBackdrop() {
  const [smallStars, setSmallStars] = React.useState("")
  const [mediumStars, setMediumStars] = React.useState("")
  const [bigStars, setBigStars] = React.useState("")

  React.useEffect(() => {
    // Kept deliberately lighter than the hero's own starfield — this layer
    // runs for the entire session (it's fixed), so it stacks on top of the
    // hero's animation cost rather than replacing it.
    setSmallStars(generateStarBoxShadow(220))
    setMediumStars(generateStarBoxShadow(70))
    setBigStars(generateStarBoxShadow(30))
  }, [])

  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none"
      style={{
        background:
          "linear-gradient(to bottom, #0d1726 0%, #090a0f 45%, #020610 100%)",
      }}
    >
      <div className="cosmic-stars opacity-70" style={{ boxShadow: smallStars }} />
      <div className="cosmic-stars-medium opacity-50" style={{ boxShadow: mediumStars }} />
      <div className="cosmic-stars-large opacity-40" style={{ boxShadow: bigStars }} />
    </div>
  )
}
