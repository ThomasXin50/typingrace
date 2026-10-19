import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoundBotResults } from './useRoundBotResults'

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

describe('useRoundBotResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.eq.mockResolvedValue({
      data: [
        {
          bot_id: 'bot-2',
          personality: 'typist',
          wpm: 70,
          placement: 2,
          field_size: 2,
        },
        {
          bot_id: 'bot-1',
          personality: 'coder',
          wpm: 90,
          placement: 1,
          field_size: 2,
        },
      ],
      error: null,
    })
  })

  it('loads bot results sorted by placement', async () => {
    const { result } = renderHook(() => useRoundBotResults('round-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.results.map((r) => r.bot_id)).toEqual([
      'bot-1',
      'bot-2',
    ])
    expect(result.current.error).toBeNull()
  })

  it('does nothing when roundId is null', () => {
    const { result } = renderHook(() => useRoundBotResults(null))

    expect(result.current.loading).toBe(false)
    expect(result.current.results).toEqual([])
    expect(mocks.channelFn).not.toHaveBeenCalled()
  })

  it('subscribes to round_bot_results changes and refetches', async () => {
    renderHook(() => useRoundBotResults('round-1'))

    await waitFor(() => expect(mocks.eq).toHaveBeenCalledTimes(1))

    const onCall = mocks.channelMock.on.mock.calls[0]
    const handler = onCall[2] as () => void
    handler()

    await waitFor(() => expect(mocks.eq).toHaveBeenCalledTimes(2))
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useRoundBotResults('round-1'))
    await waitFor(() => expect(mocks.channelFn).toHaveBeenCalled())

    unmount()

    expect(mocks.removeChannel).toHaveBeenCalledWith(mocks.channelMock)
  })

  it('surfaces an error when the fetch fails', async () => {
    mocks.eq.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useRoundBotResults('round-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('boom')
  })
})
