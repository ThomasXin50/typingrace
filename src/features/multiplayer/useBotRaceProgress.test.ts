import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBotRaceProgress } from './useBotRaceProgress'

describe('useBotRaceProgress', () => {
  const START = Date.parse('2026-10-19T12:00:00.000Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const startedAt = (offsetMs: number) =>
    new Date(START + offsetMs).toISOString()
  const round = {
    id: 'round-1',
    calibration_wpm: null,
    started_at: startedAt(0),
  }
  const bots = [{ id: 'bot-1', personality: 'typist' as const }]

  it('does nothing until the round and text are both available', () => {
    const { result } = renderHook(() =>
      useBotRaceProgress(bots, null, null, {}, vi.fn()),
    )

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.progress).toEqual({})
  })

  it('ticks a bot toward completion over time', () => {
    const { result } = renderHook(() =>
      useBotRaceProgress(bots, round, 'hello world', {}, vi.fn()),
    )

    expect(result.current.progress['bot-1']).toBe(0)

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.progress['bot-1']).toBeGreaterThan(0)
    expect(result.current.progress['bot-1']).toBeLessThan(1)
  })

  it('stays on the start line through the pre-race countdown', () => {
    const countingDown = { ...round, started_at: startedAt(5000) }
    const { result } = renderHook(() =>
      useBotRaceProgress(bots, countingDown, 'hello world', {}, vi.fn()),
    )

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.progress['bot-1']).toBe(0)
  })

  it('waits 0.5s after the start for human reaction time and network delay', () => {
    const { result } = renderHook(() =>
      useBotRaceProgress(bots, round, 'hello world', {}, vi.fn()),
    )

    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(result.current.progress['bot-1']).toBe(0)

    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(result.current.progress['bot-1']).toBeGreaterThan(0)
  })

  it('calls onBotFinish exactly once, once the bot completes the text', () => {
    const onBotFinish = vi.fn()
    // A short text at a fast personality base wpm finishes within a few
    // seconds - plenty of ticks to also prove onBotFinish fires only once.
    renderHook(() => useBotRaceProgress(bots, round, 'hi', {}, onBotFinish))

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(onBotFinish).toHaveBeenCalledOnce()
    expect(onBotFinish).toHaveBeenCalledWith('bot-1', expect.any(Object))
  })

  it('holds a finished bot at progress 1 rather than continuing past it', () => {
    const { result } = renderHook(() =>
      useBotRaceProgress(bots, round, 'hi', {}, vi.fn()),
    )

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    const afterFinish = result.current.progress['bot-1']

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(afterFinish).toBe(1)
    expect(result.current.progress['bot-1']).toBe(1)
  })

  it('speeds a lagging bot up when the human pack is far ahead (rubber-banding)', () => {
    const humanFarAhead = { human1: 0.95 }
    const noHumanYet = {}

    const { result: withHumans } = renderHook(() =>
      useBotRaceProgress(
        bots,
        round,
        'the quick brown fox jumps over the lazy dog',
        humanFarAhead,
        vi.fn(),
      ),
    )
    const { result: withoutHumans } = renderHook(() =>
      useBotRaceProgress(
        bots,
        round,
        'the quick brown fox jumps over the lazy dog',
        noHumanYet,
        vi.fn(),
      ),
    )

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(withHumans.current.progress['bot-1']).toBeGreaterThan(
      withoutHumans.current.progress['bot-1'],
    )
  })

  it('resets and re-simulates when the round changes', () => {
    const { result, rerender } = renderHook(
      ({ round }) =>
        useBotRaceProgress(bots, round, 'hello world', {}, vi.fn()),
      { initialProps: { round } },
    )

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    const progressBeforeNewRound = result.current.progress['bot-1']
    expect(progressBeforeNewRound).toBeGreaterThan(0)

    rerender({
      round: { id: 'round-2', calibration_wpm: null, started_at: startedAt(0) },
    })

    expect(result.current.progress['bot-1']).toBe(0)
  })
})
