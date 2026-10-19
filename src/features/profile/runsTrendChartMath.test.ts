import { describe, expect, it } from 'vitest'
import {
  INNER_WIDTH,
  PAD_LEFT,
  WIDTH,
  nearestIndexForClientX,
  niceMax,
  niceMin,
  xForIndex,
  yForWpm,
} from './runsTrendChartMath'

describe('niceMax', () => {
  it('rounds up to the nearest 10, with a floor of 20', () => {
    expect(niceMax(5)).toBe(20)
    expect(niceMax(21)).toBe(30)
    expect(niceMax(90)).toBe(90)
  })
})

describe('niceMin', () => {
  it('rounds down to the nearest 10, never below 0', () => {
    expect(niceMin(5)).toBe(0)
    expect(niceMin(29)).toBe(20)
    expect(niceMin(0)).toBe(0)
  })
})

describe('xForIndex', () => {
  it('spans the full inner width across the index range', () => {
    expect(xForIndex(0, 4)).toBe(PAD_LEFT)
    expect(xForIndex(4, 4)).toBe(PAD_LEFT + INNER_WIDTH)
    expect(xForIndex(2, 4)).toBeCloseTo(PAD_LEFT + INNER_WIDTH / 2)
  })

  it('centers a single point when there is only one (maxIndex 0)', () => {
    expect(xForIndex(0, 0)).toBeCloseTo(PAD_LEFT + INNER_WIDTH / 2)
  })
})

describe('yForWpm', () => {
  it('maps the min of the range to the bottom and the max to the top', () => {
    const bottom = yForWpm(40, 40, 80)
    const top = yForWpm(80, 40, 80)
    expect(bottom).toBeGreaterThan(top)
  })

  it('does not divide by zero when min and max are equal', () => {
    expect(() => yForWpm(50, 50, 50)).not.toThrow()
  })
})

describe('nearestIndexForClientX', () => {
  const series = [
    { index: 0, wpm: 40 },
    { index: 1, wpm: 50 },
    { index: 2, wpm: 60 },
  ]

  it('maps a clientX back to the nearest series point', () => {
    const leftX = PAD_LEFT
    expect(nearestIndexForClientX(leftX, 0, WIDTH, series, 2)).toBe(0)

    const rightX = PAD_LEFT + INNER_WIDTH
    expect(nearestIndexForClientX(rightX, 0, WIDTH, series, 2)).toBe(2)
  })

  it('scales correctly when the rendered rect is not 1:1 with the viewBox', () => {
    const renderedWidth = 300 // half of WIDTH
    const rightXOnScreen = (PAD_LEFT + INNER_WIDTH) / 2
    expect(
      nearestIndexForClientX(rightXOnScreen, 0, renderedWidth, series, 2),
    ).toBe(2)
  })
})
