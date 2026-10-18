import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountUp } from './useCountUp'

function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reducedMotion,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

describe('useCountUp', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    mockMatchMedia(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts at 0 and reaches the target once the duration elapses', () => {
    const { result } = renderHook(() => useCountUp(120, 500))

    expect(result.current).toBe(0)

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current).toBe(120)
  })

  it('is partway between 0 and the target midway through the duration', () => {
    const { result } = renderHook(() => useCountUp(100, 400))

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(result.current).toBeGreaterThan(0)
    expect(result.current).toBeLessThan(100)
  })

  it('stops ticking once it reaches the target, rather than polling forever', () => {
    renderHook(() => useCountUp(50, 200))

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(vi.getTimerCount()).toBe(0)
  })

  it('jumps straight to the target under prefers-reduced-motion, no counting', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useCountUp(75, 500))

    expect(result.current).toBe(75)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('restarts from 0 if the target changes to a genuinely different value', () => {
    const { result, rerender } = renderHook(
      ({ target }) => useCountUp(target, 400),
      { initialProps: { target: 60 } },
    )

    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(result.current).toBe(60)

    rerender({ target: 90 })
    expect(result.current).toBe(0)

    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(result.current).toBe(90)
  })
})
