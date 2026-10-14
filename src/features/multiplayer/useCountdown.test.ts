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
})
