import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRaceProgress } from './useRaceProgress'

const mocks = vi.hoisted(() => {
  const channelMock = { on: vi.fn(), subscribe: vi.fn(), send: vi.fn() }
  channelMock.on.mockReturnValue(channelMock)
  channelMock.subscribe.mockReturnValue(channelMock)

  return {
    channelMock,
    channelFn: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    channel: mocks.channelFn,
    removeChannel: mocks.removeChannel,
  },
}))

describe('useRaceProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('subscribes to a per-round broadcast channel with self-echo enabled, so this player sees their own progress too', async () => {
    renderHook(() => useRaceProgress('round-1', 'me'))

    await waitFor(() =>
      expect(mocks.channelFn).toHaveBeenCalledWith('race-progress:round-1', {
        config: { broadcast: { self: true } },
      }),
    )
    expect(mocks.channelMock.on).toHaveBeenCalledWith(
      'broadcast',
      { event: 'progress' },
      expect.any(Function),
    )
    expect(mocks.channelMock.subscribe).toHaveBeenCalled()
  })

  it('tracks progress received from other participants by user id', async () => {
    const { result } = renderHook(() => useRaceProgress('round-1', 'me'))
    await waitFor(() => expect(mocks.channelFn).toHaveBeenCalled())

    const onCall = mocks.channelMock.on.mock.calls.find(
      (call) => call[0] === 'broadcast',
    )
    const handler = onCall![2] as (msg: { payload: unknown }) => void

    act(() => {
      handler({ payload: { userId: 'alice', progressPct: 0.5 } })
    })

    expect(result.current.progress).toEqual({ alice: 0.5 })

    act(() => {
      handler({ payload: { userId: 'bob', progressPct: 0.2 } })
    })
    expect(result.current.progress).toEqual({ alice: 0.5, bob: 0.2 })

    act(() => {
      handler({ payload: { userId: 'alice', progressPct: 0.8 } })
    })
    expect(result.current.progress).toEqual({ alice: 0.8, bob: 0.2 })
  })

  it("sends this player's own progress tagged with their user id", async () => {
    const { result } = renderHook(() => useRaceProgress('round-1', 'me'))
    await waitFor(() => expect(mocks.channelMock.subscribe).toHaveBeenCalled())

    act(() => {
      result.current.sendProgress(0.4)
    })

    expect(mocks.channelMock.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'progress',
      payload: { userId: 'me', progressPct: 0.4 },
    })
  })

  it('does nothing when roundId or userId is null (round/profile not loaded yet)', () => {
    renderHook(() => useRaceProgress(null, 'me'))
    renderHook(() => useRaceProgress('round-1', null))

    expect(mocks.channelFn).not.toHaveBeenCalled()
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useRaceProgress('round-1', 'me'))
    await waitFor(() => expect(mocks.channelFn).toHaveBeenCalled())

    unmount()

    expect(mocks.removeChannel).toHaveBeenCalledWith(mocks.channelMock)
  })
})
