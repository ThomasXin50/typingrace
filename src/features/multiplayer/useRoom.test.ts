import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoom } from './useRoom'

const mocks = vi.hoisted(() => {
  const channelMock = {
    on: vi.fn(),
    subscribe: vi.fn(),
  }
  channelMock.on.mockReturnValue(channelMock)
  channelMock.subscribe.mockReturnValue(channelMock)

  return {
    roomSingle: vi.fn(),
    membersEq: vi.fn(),
    botsEq: vi.fn(),
    channelMock,
    channelFn: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'rooms') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: mocks.roomSingle }) }),
        }
      }
      if (table === 'room_bots') {
        return { select: () => ({ eq: mocks.botsEq }) }
      }
      return { select: () => ({ eq: mocks.membersEq }) }
    },
    channel: mocks.channelFn,
    removeChannel: mocks.removeChannel,
  },
}))

describe('useRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.roomSingle.mockResolvedValue({
      data: {
        id: 'room-1',
        host_id: 'host',
        status: 'lobby',
        max_players: 8,
        difficulty_filter: 'all',
        join_code: 'ABC123',
      },
      error: null,
    })
    mocks.membersEq.mockResolvedValue({
      data: [
        {
          user_id: 'host',
          status: 'active',
          joined_at: '2026-01-01T00:00:00Z',
          profiles: { username: 'alice', is_anonymous: false },
        },
      ],
      error: null,
    })
    mocks.botsEq.mockResolvedValue({
      data: [{ id: 'bot-1', personality: 'coder' }],
      error: null,
    })
  })

  it('loads the room and roster, joining profile data onto each member', async () => {
    const { result } = renderHook(() => useRoom('room-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.room?.id).toBe('room-1')
    expect(result.current.members).toEqual([
      {
        user_id: 'host',
        status: 'active',
        joined_at: '2026-01-01T00:00:00Z',
        username: 'alice',
        is_anonymous: false,
      },
    ])
    expect(result.current.error).toBeNull()
  })

  it('loads the room bots alongside the human roster', async () => {
    const { result } = renderHook(() => useRoom('room-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.bots).toEqual([{ id: 'bot-1', personality: 'coder' }])
  })

  it('subscribes to a per-room realtime channel for rooms, room_members, and room_bots', async () => {
    renderHook(() => useRoom('room-1'))

    await waitFor(() =>
      expect(mocks.channelFn).toHaveBeenCalledWith('room:room-1'),
    )

    expect(mocks.channelMock.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'room_members' }),
      expect.any(Function),
    )
    expect(mocks.channelMock.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'rooms' }),
      expect.any(Function),
    )
    expect(mocks.channelMock.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'room_bots' }),
      expect.any(Function),
    )
    expect(mocks.channelMock.subscribe).toHaveBeenCalled()
  })

  it('unsubscribes the channel on unmount', async () => {
    const { unmount } = renderHook(() => useRoom('room-1'))

    await waitFor(() => expect(mocks.channelFn).toHaveBeenCalled())

    unmount()

    expect(mocks.removeChannel).toHaveBeenCalledWith(mocks.channelMock)
  })

  it('refetches the room, roster, and bots when a realtime change event fires', async () => {
    renderHook(() => useRoom('room-1'))

    await waitFor(() => expect(mocks.roomSingle).toHaveBeenCalledTimes(1))

    const onCall = mocks.channelMock.on.mock.calls.find(
      (call) => (call[1] as { table?: string })?.table === 'room_members',
    )
    const handler = onCall![2] as () => void
    handler()

    await waitFor(() => expect(mocks.roomSingle).toHaveBeenCalledTimes(2))
  })

  it('refetches when a room_bots realtime change event fires', async () => {
    renderHook(() => useRoom('room-1'))

    await waitFor(() => expect(mocks.roomSingle).toHaveBeenCalledTimes(1))

    const onCall = mocks.channelMock.on.mock.calls.find(
      (call) => (call[1] as { table?: string })?.table === 'room_bots',
    )
    const handler = onCall![2] as () => void
    handler()

    await waitFor(() => expect(mocks.roomSingle).toHaveBeenCalledTimes(2))
  })

  it('surfaces an error when the room fetch fails', async () => {
    mocks.roomSingle.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    })

    const { result } = renderHook(() => useRoom('room-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('boom')
  })
})
