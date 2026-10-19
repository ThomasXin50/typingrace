// Mirrors the within-run WpmChart's math module in structure, but is
// deliberately its own independent module rather than a shared/refactored
// one: the data semantics genuinely differ. A within-run chart's x-axis is
// real elapsed seconds that legitimately start at 0; this chart's x-axis
// is a run sequence index with no such origin, and its y-axis is scaled to
// the actual wpm range rather than forced through 0 - a user whose runs
// cluster between 60-80 wpm shouldn't have that variation compressed into
// a sliver at the top of a 0-80 chart.
export interface RunsTrendPoint {
  index: number
  wpm: number
}

export const WIDTH = 600
export const HEIGHT = 160
export const PAD_LEFT = 34
export const PAD_RIGHT = 12
export const PAD_TOP = 12
export const PAD_BOTTOM = 24
export const INNER_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT
export const INNER_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM

export function niceMax(value: number): number {
  return Math.max(20, Math.ceil(value / 10) * 10)
}

export function niceMin(value: number): number {
  return Math.max(0, Math.floor(value / 10) * 10)
}

export function xForIndex(index: number, maxIndex: number): number {
  if (maxIndex === 0) return PAD_LEFT + INNER_WIDTH / 2
  return PAD_LEFT + (index / maxIndex) * INNER_WIDTH
}

export function yForWpm(wpm: number, minWpm: number, maxWpm: number): number {
  const range = maxWpm - minWpm || 1
  return PAD_TOP + INNER_HEIGHT - ((wpm - minWpm) / range) * INNER_HEIGHT
}

/** Maps a pointer's clientX (given the SVG's on-screen rect) to the index of
 * the nearest series point, in the chart's internal coordinate space. Pure
 * so the hover math is directly testable without simulating real pointer
 * events (jsdom doesn't reliably report clientX on synthetic ones). */
export function nearestIndexForClientX(
  clientX: number,
  rectLeft: number,
  rectWidth: number,
  series: RunsTrendPoint[],
  maxIndex: number,
): number {
  const px = ((clientX - rectLeft) / rectWidth) * WIDTH
  const indexAtPointer = ((px - PAD_LEFT) / INNER_WIDTH) * maxIndex

  let nearest = 0
  let nearestDist = Infinity
  series.forEach((p, i) => {
    const dist = Math.abs(p.index - indexAtPointer)
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = i
    }
  })
  return nearest
}
