import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTypingEngine } from './useTypingEngine'

function press(key: string, timestamp: number, trusted = true) {
  return { key, timestamp, trusted }
}

describe('useTypingEngine', () => {
  it('starts idle with every character pending except the first', () => {
    const { result } = renderHook(() => useTypingEngine('abc'))

    expect(result.current.status).toBe('idle')
    expect(result.current.charStatuses).toEqual([
      'current',
      'pending',
      'pending',
    ])
    expect(result.current.stats).toBeNull()
    expect(result.current.keystrokes).toEqual([])
  })

  it('marks correct and incorrect characters while typing, continuing through errors', () => {
    const { result } = renderHook(() => useTypingEngine('abc'))

    act(() => result.current.handleKeyDown(press('a', 0)))
    expect(result.current.status).toBe('running')
    expect(result.current.charStatuses).toEqual([
      'correct',
      'current',
      'pending',
    ])

    act(() => result.current.handleKeyDown(press('x', 100)))
    expect(result.current.charStatuses).toEqual([
      'correct',
      'incorrect',
      'current',
    ])
  })

  it('removes the last character on backspace without counting it as a new keystroke', () => {
    const { result } = renderHook(() => useTypingEngine('abc'))

    act(() => result.current.handleKeyDown(press('x', 0)))
    act(() => result.current.handleKeyDown(press('Backspace', 100)))

    expect(result.current.typed).toBe('')
    expect(result.current.charStatuses).toEqual([
      'current',
      'pending',
      'pending',
    ])
  })

  it('records every keydown in order, including backspace and untrusted events', () => {
    const { result } = renderHook(() => useTypingEngine('ab'))

    act(() => result.current.handleKeyDown(press('x', 0, false)))
    act(() => result.current.handleKeyDown(press('Backspace', 100)))
    act(() => result.current.handleKeyDown(press('a', 200)))

    expect(result.current.keystrokes).toEqual([
      press('x', 0, false),
      press('Backspace', 100),
      press('a', 200),
    ])
  })

  it('finishes when typed length reaches the text length and computes stats', () => {
    const text = 'a'.repeat(25) // 25 chars = 5 "words" at 5 chars/word
    const { result } = renderHook(() => useTypingEngine(text))

    // First-to-last keystroke spans exactly 60s (24 intervals) => 5 wpm.
    const interval = 60_000 / 24
    for (let i = 0; i < text.length; i++) {
      act(() => result.current.handleKeyDown(press('a', i * interval)))
    }

    expect(result.current.status).toBe('finished')
    expect(result.current.stats).toEqual({
      wpm: 5,
      rawWpm: 5,
      accuracy: 100,
      durationMs: 60_000,
      errorCount: 0,
    })
  })

  it('counts a corrected mistake toward error count and accuracy', () => {
    const { result } = renderHook(() => useTypingEngine('ab'))

    act(() => result.current.handleKeyDown(press('x', 0))) // mistake
    act(() => result.current.handleKeyDown(press('Backspace', 100)))
    act(() => result.current.handleKeyDown(press('a', 200)))
    act(() => result.current.handleKeyDown(press('b', 300))) // finishes

    expect(result.current.status).toBe('finished')
    expect(result.current.stats?.errorCount).toBe(1)
    expect(result.current.stats?.accuracy).toBeCloseTo((2 / 3) * 100)
  })

  it('ignores further input once finished', () => {
    const { result } = renderHook(() => useTypingEngine('ab'))

    act(() => result.current.handleKeyDown(press('a', 0)))
    act(() => result.current.handleKeyDown(press('b', 100)))
    const statsAfterFinish = result.current.stats
    const keystrokesAfterFinish = result.current.keystrokes

    act(() => result.current.handleKeyDown(press('c', 200)))

    expect(result.current.typed).toBe('ab')
    expect(result.current.stats).toEqual(statsAfterFinish)
    expect(result.current.keystrokes).toEqual(keystrokesAfterFinish)
  })

  it('computes duration against an externally-provided startTimestamp instead of the first keystroke, when given', () => {
    const text = 'a'.repeat(25) // 5 "words"
    const raceStart = 10_000 // wall-clock ms, e.g. Date.parse(round.started_at)
    const { result } = renderHook(() =>
      useTypingEngine(text, { startTimestamp: raceStart }),
    )

    // The player's own first keystroke lands 30s after the official start -
    // a late reaction should count against them, not reset the clock.
    const firstKeystroke = raceStart + 30_000
    const interval = 60_000 / 24 // 24 intervals spans the rest of 60s total
    for (let i = 0; i < text.length; i++) {
      act(() =>
        result.current.handleKeyDown(press('a', firstKeystroke + i * interval)),
      )
    }

    expect(result.current.status).toBe('finished')
    // Elapsed from raceStart to the last keystroke is 90s, not 60s from the
    // first keystroke - so wpm is 5*(60/90) = 10/3, not 5.
    expect(result.current.stats?.durationMs).toBe(90_000)
    expect(result.current.stats?.wpm).toBeCloseTo(10 / 3)
  })

  it("without startTimestamp, duration is unaffected (matches today's solo behavior exactly)", () => {
    const text = 'a'.repeat(25)
    const { result } = renderHook(() => useTypingEngine(text))

    const interval = 60_000 / 24
    for (let i = 0; i < text.length; i++) {
      act(() => result.current.handleKeyDown(press('a', i * interval)))
    }

    expect(result.current.stats?.durationMs).toBe(60_000)
    expect(result.current.stats?.wpm).toBe(5)
  })

  it('reset returns to the idle state and clears the keystroke log', () => {
    const { result } = renderHook(() => useTypingEngine('ab'))

    act(() => result.current.handleKeyDown(press('a', 0)))
    act(() => result.current.handleKeyDown(press('b', 100)))
    act(() => result.current.reset())

    expect(result.current.status).toBe('idle')
    expect(result.current.typed).toBe('')
    expect(result.current.stats).toBeNull()
    expect(result.current.keystrokes).toEqual([])
  })
})
