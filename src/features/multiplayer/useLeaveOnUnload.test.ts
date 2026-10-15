import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLeaveOnUnload } from './useLeaveOnUnload'

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession } },
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon-key',
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

  it('sends a keepalive leave-room request on pagehide, authenticated with the current session', async () => {
    renderHook(() => useLeaveOnUnload('room-1'))

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

  it('does not send anything when there is no active session', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })

    renderHook(() => useLeaveOnUnload('room-1'))
    window.dispatchEvent(new Event('pagehide'))
    await Promise.resolve()
    await Promise.resolve()

    expect(fetch).not.toHaveBeenCalled()
  })

  it('does nothing while roomId is null', async () => {
    renderHook(() => useLeaveOnUnload(null))

    window.dispatchEvent(new Event('pagehide'))
    await Promise.resolve()

    expect(fetch).not.toHaveBeenCalled()
  })

  it('stops listening once unmounted', async () => {
    const { unmount } = renderHook(() => useLeaveOnUnload('room-1'))
    unmount()

    window.dispatchEvent(new Event('pagehide'))
    await Promise.resolve()

    expect(fetch).not.toHaveBeenCalled()
  })
})
