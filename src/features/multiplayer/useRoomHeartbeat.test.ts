import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoomHeartbeat } from './useRoomHeartbeat'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}))

describe('useRoomHeartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does nothing while roomId is null', () => {
    renderHook(() => useRoomHeartbeat(null))

    vi.advanceTimersByTime(30_000)

    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('beats immediately on mount, then every 5s, while roomId is present', () => {
    renderHook(() => useRoomHeartbeat('room-1'))

    expect(mocks.invoke).toHaveBeenCalledTimes(1)
    expect(mocks.invoke).toHaveBeenCalledWith('heartbeat-room-member', {
      body: { roomId: 'room-1' },
    })

    vi.advanceTimersByTime(5000)
    expect(mocks.invoke).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(5000)
    expect(mocks.invoke).toHaveBeenCalledTimes(3)
  })

  it('stops beating once unmounted', () => {
    const { unmount } = renderHook(() => useRoomHeartbeat('room-1'))
    expect(mocks.invoke).toHaveBeenCalledTimes(1)

    unmount()
    vi.advanceTimersByTime(20_000)

    expect(mocks.invoke).toHaveBeenCalledTimes(1)
  })
})
