import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useActiveRound } from './useActiveRound'

const mocks = vi.hoisted(() => {
  const channelMock = { on: vi.fn(), subscribe: vi.fn() }
  channelMock.on.mockReturnValue(channelMock)
  channelMock.subscribe.mockReturnValue(channelMock)

  return {
    maybeSingle: vi.fn(),
    channelMock,
    channelFn: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: mocks.maybeSingle,
              }),
            }),
          }),
        }),
      }),
    }),
    channel: mocks.channelFn,
    removeChannel: mocks.removeChannel,
  },
}))

describe('useActiveRound', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the current active round for a room', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: 'round-1',
        room_id: 'room-1',
        text_id: 'text-1',
        status: 'active',
        started_at: '2026-01-01T00:00:05Z',
      },
      error: null,
    })

    const { result } = renderHook(() => useActiveRound('room-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.round?.id).toBe('round-1')
    expect(result.current.error).toBeNull()
  })

  it('returns null when there is no active round', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })

    const { result } = renderHook(() => useActiveRound('room-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.round).toBeNull()
  })

  it('subscribes to a per-room realtime channel for rounds', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })

    renderHook(() => useActiveRound('room-1'))

    await waitFor(() =>
      expect(mocks.channelFn).toHaveBeenCalledWith('round:room-1'),
    )
    expect(mocks.channelMock.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'rounds' }),
      expect.any(Function),
    )
  })

  it('unsubscribes on unmount', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })

    const { unmount } = renderHook(() => useActiveRound('room-1'))
    await waitFor(() => expect(mocks.channelFn).toHaveBeenCalled())

    unmount()

    expect(mocks.removeChannel).toHaveBeenCalledWith(mocks.channelMock)
  })

  it('surfaces an error when the fetch fails', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    })

    const { result } = renderHook(() => useActiveRound('room-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('boom')
  })
})
