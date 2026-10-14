import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountdown } from './useCountdown'

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts down toward the start time and flips hasStarted once it passes', () => {
    const { result } = renderHook(() =>
      useCountdown('2026-01-01T00:00:03.000Z'),
    )

    expect(result.current.hasStarted).toBe(false)
    expect(result.current.msRemaining).toBe(3000)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.msRemaining).toBe(2000)
    expect(result.current.hasStarted).toBe(false)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.msRemaining).toBe(0)
    expect(result.current.hasStarted).toBe(true)
  })

  it('is already started if given a start time in the past', () => {
    const { result } = renderHook(() =>
      useCountdown('2025-12-31T23:59:00.000Z'),
    )

    expect(result.current.hasStarted).toBe(true)
    expect(result.current.msRemaining).toBe(0)
  })

  it('stops ticking once started, rather than polling forever', () => {
    const { result } = renderHook(() =>
      useCountdown('2026-01-01T00:00:01.000Z'),
    )

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.hasStarted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('resyncs immediately when startedAt changes to a genuinely different value, without waiting for the next tick (a caller that initially renders with a placeholder, then the real value once data loads, must never show a stale number in between)', () => {
    const { result, rerender } = renderHook(
      ({ startedAt }) => useCountdown(startedAt),
      { initialProps: { startedAt: '2099-01-01T00:00:00.000Z' } },
    )

    // Placeholder read as "far from started" - this is the state a caller
    // would see while still loading real data.
    expect(result.current.hasStarted).toBe(false)

    // The real round data arrives: 5s out from "now".
    rerender({ startedAt: '2026-01-01T00:00:05.000Z' })

    // Must reflect the real value synchronously on this same render, not
    // the placeholder's multi-decade-away remaining time, and not 0
    // either - both would be visibly wrong before the next tick.
    expect(result.current.msRemaining).toBe(5000)
    expect(result.current.hasStarted).toBe(false)
  })
})
