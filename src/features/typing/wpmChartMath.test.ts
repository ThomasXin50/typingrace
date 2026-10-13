import { describe, expect, it } from 'vitest'
import { nearestIndexForClientX } from './wpmChartMath'

describe('nearestIndexForClientX', () => {
  it('maps a clientX back to the nearest series point', () => {
    // 600-wide internal viewBox, padding 34/12, so innerWidth=554.
    // series includes the prepended (0,0) origin: [0, 1, 2, 3].
    const series = [
      { timeSec: 0, wpm: 0 },
      { timeSec: 1, wpm: 80 },
      { timeSec: 2, wpm: 95 },
      { timeSec: 3, wpm: 90 },
    ]
    const maxTime = 3

    // x(2) = 34 + (2/3)*554 ≈ 403.3; with a 1:1 rect (left 0, width 600)
    // clientX maps directly to internal px.
    expect(nearestIndexForClientX(403, 0, 600, series, maxTime)).toBe(2)
    expect(nearestIndexForClientX(34, 0, 600, series, maxTime)).toBe(0)
    expect(nearestIndexForClientX(588, 0, 600, series, maxTime)).toBe(3)
  })

  it('scales correctly when the rendered rect is not 1:1 with the viewBox', () => {
    const series = [
      { timeSec: 0, wpm: 0 },
      { timeSec: 1, wpm: 80 },
    ]
    // Rendered at half size (300px wide) starting at screen x=100.
    // Internal x(1) = 34 + 554 = 588, i.e. 98% across -> clientX ≈ 100 + 0.98*300.
    const clientX = 100 + (588 / 600) * 300
    expect(nearestIndexForClientX(clientX, 100, 300, series, 1)).toBe(1)
  })
})
