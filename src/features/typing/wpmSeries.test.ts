import { describe, expect, it } from 'vitest'
import { computeWpmSeries } from './wpmSeries'
import type { Keystroke } from './useTypingEngine'

function typeText(
  text: string,
  startAt: number,
  msPerChar: number,
): Keystroke[] {
  return text.split('').map((key, i) => ({
    key,
    timestamp: startAt + i * msPerChar,
    trusted: true,
  }))
}

describe('computeWpmSeries', () => {
  it('ignores non-character keys like modifiers', () => {
    const text = 'a'.repeat(31)
    const keystrokes: Keystroke[] = [
      { key: 'Shift', timestamp: 0, trusted: true },
      ...typeText(text, 0, 4000 / 30),
    ]

    const withIgnored = computeWpmSeries(text, keystrokes)
    const withoutIgnored = computeWpmSeries(text, typeText(text, 0, 4000 / 30))

    expect(withIgnored).toEqual(withoutIgnored)
  })

  it('returns empty for a run shorter than 3 buckets (not enough signal)', () => {
    const text = 'ab'
    const keystrokes = typeText(text, 0, 500) // ~1s total

    expect(computeWpmSeries(text, keystrokes)).toEqual([])
  })

  it('buckets a steady run into one point per second', () => {
    // 40 chars = 8 words, typed over 4 seconds at a steady pace.
    const text = 'a'.repeat(40)
    const keystrokes = typeText(text, 0, 4000 / 39)

    const series = computeWpmSeries(text, keystrokes)

    expect(series).toHaveLength(4)
    expect(series[3].timeSec).toBe(4)
    // Steady pace: each bucket should read close to the overall average
    // (8 words / 4s = 120 wpm), not wildly uneven.
    for (const point of series) {
      expect(point.wpm).toBeGreaterThan(90)
      expect(point.wpm).toBeLessThan(150)
    }
  })

  it('shows a dip in a bucket where net progress stalls from backspacing', () => {
    const text = 'a'.repeat(30)
    const keystrokes: Keystroke[] = [
      ...typeText('a'.repeat(10), 0, 100), // 0-900ms: steady progress
      // second 1000-2000ms: type a mistake then backspace repeatedly, no net progress
      { key: 'x', timestamp: 1200, trusted: true },
      { key: 'Backspace', timestamp: 1400, trusted: true },
      { key: 'x', timestamp: 1600, trusted: true },
      { key: 'Backspace', timestamp: 1900, trusted: true },
      ...typeText('a'.repeat(20), 2050, 100), // resumes progress just after the 2s boundary
    ]

    const series = computeWpmSeries(text, keystrokes)
    const stalledBucket = series.find((p) => p.timeSec === 2)

    expect(stalledBucket?.wpm).toBe(0)
  })

  it('never produces two points with the same timeSec, even when the run finishes mid-second', () => {
    const text = 'a'.repeat(10)
    // Finishes at 5345ms - the last (partial) bucket only covers
    // [5000, 5345), which rounds to the same second as the prior full
    // bucket [4000, 5000) if timeSec is computed via Math.round() instead
    // of being derived from the bucket index.
    const keystrokes: Keystroke[] = [
      { key: 'a', timestamp: 0, trusted: true },
      { key: 'a', timestamp: 1000, trusted: true },
      { key: 'a', timestamp: 2000, trusted: true },
      { key: 'a', timestamp: 3000, trusted: true },
      { key: 'a', timestamp: 4000, trusted: true },
      { key: 'a', timestamp: 4300, trusted: true },
      { key: 'a', timestamp: 4600, trusted: true },
      { key: 'a', timestamp: 4900, trusted: true },
      { key: 'a', timestamp: 5100, trusted: true },
      { key: 'a', timestamp: 5345, trusted: true },
    ]

    const series = computeWpmSeries(text, keystrokes)
    const timeSecs = series.map((p) => p.timeSec)

    expect(new Set(timeSecs).size).toBe(timeSecs.length)
    expect(timeSecs).toEqual([1, 2, 3, 4, 5, 6])
  })

  it("anchors bucket timing to an explicit startTimestamp instead of the first keystroke, when given (races: the shared synchronized start, not this player's reaction time)", () => {
    const text = 'a'.repeat(10)
    const reactionDelayMs = 3500
    const keystrokes: Keystroke[] = Array.from({ length: 10 }, (_, i) => ({
      key: 'a',
      timestamp: reactionDelayMs + i * 1000,
      trusted: true,
    }))

    const series = computeWpmSeries(text, keystrokes, 0)

    // The buckets before the player's first keystroke are real,
    // zero-progress time - the clock was already running from
    // startTimestamp, not from whenever they got around to typing.
    expect(series[0].wpm).toBe(0)
    expect(series[1].wpm).toBe(0)
    expect(series[2].wpm).toBe(0)
    expect(series.at(-1)?.timeSec).toBe(13)

    // Without an explicit startTimestamp, bucketing still anchors to the
    // first keystroke as before (solo/practice, unaffected).
    const withoutStart = computeWpmSeries(text, keystrokes)
    expect(withoutStart[0].wpm).toBeGreaterThan(0)
    expect(withoutStart.at(-1)?.timeSec).toBe(9)
  })

  it('tracks net (error-adjusted) and raw progress separately, diverging only in a bucket with an uncorrected typo', () => {
    const text = 'a'.repeat(15)
    const keystrokes: Keystroke[] = [
      ...typeText('a'.repeat(14), 0, 1000), // 14 correct chars, one per second
      { key: 'x', timestamp: 14000, trusted: true }, // wrong, but finishes - never corrected
    ]

    const series = computeWpmSeries(text, keystrokes)

    // Every bucket before the typo: raw and net agree (nothing but correct
    // progress happened in them).
    for (const point of series.slice(0, -1)) {
      expect(point.rawWpm).toBeCloseTo(point.wpm)
    }

    // The bucket containing the uncorrected typo: raw counts it as
    // progress (it advanced the cursor), net doesn't (it's wrong and
    // never fixed) - raw must read higher.
    const last = series.at(-1)!
    expect(last.rawWpm).toBeGreaterThan(last.wpm)
  })

  it('never reports negative wpm even when a bucket nets backward', () => {
    const text = 'a'.repeat(25)
    const keystrokes: Keystroke[] = [
      ...typeText('a'.repeat(10), 0, 90), // typed.length=10 by ~810ms
      { key: 'Backspace', timestamp: 1100, trusted: true }, // 9
      { key: 'Backspace', timestamp: 1300, trusted: true }, // 8
      { key: 'Backspace', timestamp: 1500, trusted: true }, // 7
      ...typeText('a'.repeat(18), 2000, 100), // resumes, finishes at 7+18=25
    ]

    const series = computeWpmSeries(text, keystrokes)

    expect(series.length).toBeGreaterThan(0)
    for (const point of series) {
      expect(point.wpm).toBeGreaterThanOrEqual(0)
    }
  })
})
