import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStallWatcher } from './useStallWatcher'

describe('useStallWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does nothing while inactive', () => {
    const onStall = vi.fn()
    renderHook(() => useStallWatcher({ active: false, onStall }))

    act(() => {
      vi.advanceTimersByTime(20_000)
    })

    expect(onStall).not.toHaveBeenCalled()
  })

  it('fires onStall after 10s with no ping, once active', () => {
    const onStall = vi.fn()
    renderHook(() => useStallWatcher({ active: true, onStall }))

    act(() => {
      vi.advanceTimersByTime(9999)
    })
    expect(onStall).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onStall).toHaveBeenCalledOnce()
  })

  it('ping() resets the 10s window, so it never fires while pings keep arriving', () => {
    const onStall = vi.fn()
    const { result } = renderHook(() => useStallWatcher({ active: true, onStall }))

    act(() => {
      vi.advanceTimersByTime(7000)
    })
    act(() => {
      result.current()
    })
    act(() => {
      vi.advanceTimersByTime(7000)
    })

    expect(onStall).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(onStall).toHaveBeenCalledOnce()
  })

  it('stops watching once active flips back to false before the timeout elapses', () => {
    const onStall = vi.fn()
    const { rerender } = renderHook(
      ({ active }) => useStallWatcher({ active, onStall }),
      { initialProps: { active: true } },
    )

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    rerender({ active: false })

    act(() => {
      vi.advanceTimersByTime(20_000)
    })

    expect(onStall).not.toHaveBeenCalled()
  })
})
