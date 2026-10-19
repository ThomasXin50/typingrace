// Deliberately not WpmPoint from wpmSeries.ts - the chart math only ever
// plots a single already-chosen value per timestamp (net or raw wpm, after
// WpmChart resolves the toggle), so it stays agnostic to which field that
// value came from rather than depending on wpmSeries' full data shape.
export interface ChartPoint {
  timeSec: number
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

export function withOrigin(points: ChartPoint[]): ChartPoint[] {
  return [{ timeSec: 0, wpm: 0 }, ...points]
}

export function xForTime(timeSec: number, maxTime: number): number {
  return PAD_LEFT + (timeSec / maxTime) * INNER_WIDTH
}

export function yForWpm(wpm: number, maxWpm: number): number {
  return PAD_TOP + INNER_HEIGHT - (wpm / maxWpm) * INNER_HEIGHT
}

/** Maps a pointer's clientX (given the SVG's on-screen rect) to the index of
 * the nearest series point, in the chart's internal coordinate space. Pure
 * so the hover math is directly testable without simulating real pointer
 * events (jsdom doesn't reliably report clientX on synthetic ones). */
export function nearestIndexForClientX(
  clientX: number,
  rectLeft: number,
  rectWidth: number,
  series: ChartPoint[],
  maxTime: number,
): number {
  const px = ((clientX - rectLeft) / rectWidth) * WIDTH
  const timeAtPointer = ((px - PAD_LEFT) / INNER_WIDTH) * maxTime

  let nearest = 0
  let nearestDist = Infinity
  series.forEach((p, i) => {
    const dist = Math.abs(p.timeSec - timeAtPointer)
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = i
    }
  })
  return nearest
}
