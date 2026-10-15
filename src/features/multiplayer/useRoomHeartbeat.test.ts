import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoomHeartbeat } from './useRoomHeartbeat'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  getCurrentRoomId: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}))

vi.mock('./currentRoom', () => ({
  getCurrentRoomId: mocks.getCurrentRoomId,
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

  it('does nothing while no room is current', () => {
    mocks.getCurrentRoomId.mockReturnValue(null)

    renderHook(() => useRoomHeartbeat())

    vi.advanceTimersByTime(30_000)

    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('beats immediately on mount, then every 5s, while a room is current', () => {
    mocks.getCurrentRoomId.mockReturnValue('room-1')

    renderHook(() => useRoomHeartbeat())

    expect(mocks.invoke).toHaveBeenCalledTimes(1)
    expect(mocks.invoke).toHaveBeenCalledWith('heartbeat-room-member', {
      body: { roomId: 'room-1' },
    })

    vi.advanceTimersByTime(5000)
    expect(mocks.invoke).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(5000)
    expect(mocks.invoke).toHaveBeenCalledTimes(3)
  })

  it('reads the current room fresh on every tick, surviving navigation away from and back to a room without missing a beat', () => {
    mocks.getCurrentRoomId.mockReturnValue(null)

    renderHook(() => useRoomHeartbeat())
    expect(mocks.invoke).not.toHaveBeenCalled()

    // The player enters a room sometime after this hook (mounted once,
    // at the app level) was already running.
    mocks.getCurrentRoomId.mockReturnValue('room-1')
    vi.advanceTimersByTime(5000)
    expect(mocks.invoke).toHaveBeenCalledWith('heartbeat-room-member', {
      body: { roomId: 'room-1' },
    })

    // Navigating away from the room page (but not closing the tab)
    // doesn't unmount this hook - it's at the app level - so it correctly
    // stops beating the instant currentRoom says there's no room anymore,
    // without needing to unmount/remount anything.
    mocks.getCurrentRoomId.mockReturnValue(null)
    vi.advanceTimersByTime(5000)
    expect(mocks.invoke).toHaveBeenCalledTimes(1)
  })

  it('stops beating once unmounted', () => {
    mocks.getCurrentRoomId.mockReturnValue('room-1')

    const { unmount } = renderHook(() => useRoomHeartbeat())
    expect(mocks.invoke).toHaveBeenCalledTimes(1)

    unmount()
    vi.advanceTimersByTime(20_000)

    expect(mocks.invoke).toHaveBeenCalledTimes(1)
  })
})
