import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLeaveOnUnload } from './useLeaveOnUnload'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getCurrentRoomId: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession } },
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon-key',
}))

vi.mock('./currentRoom', () => ({
  getCurrentRoomId: mocks.getCurrentRoomId,
}))

describe('useLeaveOnUnload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response()))
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'the-token' } },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a keepalive leave-room request on pagehide, for whichever room is currently active', async () => {
    mocks.getCurrentRoomId.mockReturnValue('room-1')

    renderHook(() => useLeaveOnUnload())

    window.dispatchEvent(new Event('pagehide'))
    await Promise.resolve()
    await Promise.resolve()

    expect(fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/leave-room',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer the-token',
          apikey: 'anon-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId: 'room-1' }),
        keepalive: true,
      },
    )
  })

  it('does not send anything when no room is current', async () => {
    mocks.getCurrentRoomId.mockReturnValue(null)

    renderHook(() => useLeaveOnUnload())
    window.dispatchEvent(new Event('pagehide'))
    await Promise.resolve()

    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not send anything when there is no active session', async () => {
    mocks.getCurrentRoomId.mockReturnValue('room-1')
    mocks.getSession.mockResolvedValue({ data: { session: null } })

    renderHook(() => useLeaveOnUnload())
    window.dispatchEvent(new Event('pagehide'))
    await Promise.resolve()
    await Promise.resolve()

    expect(fetch).not.toHaveBeenCalled()
  })

  it('stops listening once unmounted', async () => {
    mocks.getCurrentRoomId.mockReturnValue('room-1')

    const { unmount } = renderHook(() => useLeaveOnUnload())
    unmount()

    window.dispatchEvent(new Event('pagehide'))
    await Promise.resolve()

    expect(fetch).not.toHaveBeenCalled()
  })
})
