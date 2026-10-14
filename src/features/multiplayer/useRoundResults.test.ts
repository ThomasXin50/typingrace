import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoundResults } from './useRoundResults'

const mocks = vi.hoisted(() => {
  const channelMock = { on: vi.fn(), subscribe: vi.fn() }
  channelMock.on.mockReturnValue(channelMock)
  channelMock.subscribe.mockReturnValue(channelMock)

  return {
    eq: vi.fn(),
    channelMock,
    channelFn: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: mocks.eq }) }),
    channel: mocks.channelFn,
    removeChannel: mocks.removeChannel,
  },
}))

describe('useRoundResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.eq.mockResolvedValue({
      data: [
        {
          user_id: 'bob',
          status: 'finished',
          validation_status: 'verified',
          wpm: 70,
          placement: 2,
          field_size: 2,
          profiles: { username: 'bob', is_anonymous: false },
        },
        {
          user_id: 'alice',
          status: 'finished',
          validation_status: 'verified',
          wpm: 90,
          placement: 1,
          field_size: 2,
          profiles: { username: 'alice', is_anonymous: false },
        },
      ],
      error: null,
    })
  })

  it('loads results sorted by placement, joining profile data onto each row', async () => {
    const { result } = renderHook(() => useRoundResults('round-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.results.map((r) => r.user_id)).toEqual([
      'alice',
      'bob',
    ])
    expect(result.current.results[0]).toEqual({
      user_id: 'alice',
      status: 'finished',
      validation_status: 'verified',
      wpm: 90,
      placement: 1,
      field_size: 2,
      username: 'alice',
      is_anonymous: false,
    })
    expect(result.current.error).toBeNull()
  })

  it('sorts still-racing (null placement) participants after every finisher', async () => {
    mocks.eq.mockResolvedValue({
      data: [
        {
          user_id: 'alice',
          status: 'finished',
          validation_status: 'verified',
          wpm: 90,
          placement: 1,
          field_size: 2,
          profiles: { username: 'alice', is_anonymous: false },
        },
        {
          user_id: 'bob',
          status: 'racing',
          validation_status: null,
          wpm: null,
          placement: null,
          field_size: 2,
          profiles: { username: 'bob', is_anonymous: false },
        },
      ],
      error: null,
    })

    const { result } = renderHook(() => useRoundResults('round-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.results.map((r) => r.user_id)).toEqual([
      'alice',
      'bob',
    ])
  })

  it('subscribes to a per-round realtime channel for round_participants', async () => {
    renderHook(() => useRoundResults('round-1'))

    await waitFor(() =>
      expect(mocks.channelFn).toHaveBeenCalledWith('results:round-1'),
    )
    expect(mocks.channelMock.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'round_participants' }),
      expect.any(Function),
    )
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useRoundResults('round-1'))
    await waitFor(() => expect(mocks.channelFn).toHaveBeenCalled())

    unmount()

    expect(mocks.removeChannel).toHaveBeenCalledWith(mocks.channelMock)
  })

  it('does not fetch when roundId is null, and is not left loading forever', () => {
    const { result } = renderHook(() => useRoundResults(null))

    expect(result.current.loading).toBe(false)
    expect(result.current.results).toEqual([])
    expect(mocks.eq).not.toHaveBeenCalled()
  })

  it('surfaces an error when the fetch fails', async () => {
    mocks.eq.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useRoundResults('round-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('boom')
  })
})
