import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLeaderboard } from './useLeaderboard'

const mocks = vi.hoisted(() => ({
  order: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: mocks.order,
      }),
    }),
  },
}))

describe('useLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads ranked entries from the leaderboard view', async () => {
    mocks.order.mockResolvedValue({
      data: [
        {
          user_id: 'a',
          username: 'alice',
          runs: 10,
          avg_wpm: 80,
          best_wpm: 95,
          rank: 1,
        },
      ],
      error: null,
    })

    const { result } = renderHook(() => useLeaderboard())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].username).toBe('alice')
    expect(result.current.error).toBeNull()
  })

  it('returns an empty list when there are no runs yet, without an error', async () => {
    mocks.order.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useLeaderboard())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.entries).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('surfaces an error when the fetch fails', async () => {
    mocks.order.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useLeaderboard())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('boom')
  })
})
