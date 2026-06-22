export interface TocLinkMetrics {
  x: number
  top: number
  bottom: number
}

const DEPTH_OFFSET_STEP = 10
const DEPTH_PADDING_BASE = 16
const DEPTH_PADDING_STEP = 14
const BASE_DEPTH = 2

/** Horizontal offset (px) of a heading's dot/track position, deeper headings sit further right. */
export function getDepthOffset(depth: number): number {
  return Math.max(0, depth - BASE_DEPTH) * DEPTH_OFFSET_STEP
}

/** `padding-inline-start` (px) for a TOC link, clearing the dot/track plus extra indent per depth. */
export function getDepthPadding(depth: number): number {
  return DEPTH_PADDING_BASE + Math.max(0, depth - BASE_DEPTH) * DEPTH_PADDING_STEP
}

/** Vertical span (relative to the scroll-spy container) of a single TOC link. */
export function measureLinkMetrics(anchor: HTMLAnchorElement): Pick<TocLinkMetrics, "top" | "bottom"> {
  const top = anchor.offsetTop
  return { top, bottom: top + anchor.offsetHeight }
}

/** SVG path connecting each heading's track position, with a smooth curve across depth changes. */
export function buildTocPath(metrics: TocLinkMetrics[]): string {
  if (metrics.length === 0) {
    return ""
  }

  const points = metrics.map((m) => ({ x: m.x, y: (m.top + m.bottom) / 2 }))
  const first = points[0]!

  if (points.length === 1) {
    return `M ${first.x} ${first.y} L ${first.x} ${first.y}`
  }

  let path = `M ${first.x} ${first.y}`

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!
    const curr = points[i]!

    if (prev.x === curr.x) {
      path += ` L ${curr.x} ${curr.y}`
    } else {
      const midY = (prev.y + curr.y) / 2
      path += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`
    }
  }

  return path
}
