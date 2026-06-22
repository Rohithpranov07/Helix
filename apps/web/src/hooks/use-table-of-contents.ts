"use client"

import * as React from "react"

export interface TableOfContentsItem {
  id: string
  title: string
  depth?: number
}

interface UseScrollSpyOptions {
  rootMargin?: string
  threshold?: number | number[]
}

/**
 * Tracks which heading is currently "active" while scrolling, via
 * IntersectionObserver. `rootMargin` defaults to favoring headings near the
 * top third of the viewport, the conventional scroll-spy trigger zone.
 */
export function useScrollSpy(
  ids: string[],
  options: UseScrollSpyOptions = {},
): string | undefined {
  const [activeId, setActiveId] = React.useState<string | undefined>(ids[0])
  const { rootMargin = "-10% 0px -70% 0px", threshold = 0 } = options

  React.useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    if (elements.length === 0) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible.length > 0) {
          setActiveId(visible[0]!.target.id)
        }
      },
      { rootMargin, threshold },
    )

    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [ids, rootMargin, threshold])

  return activeId
}
