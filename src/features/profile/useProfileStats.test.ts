import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProfileStats } from './useProfileStats'

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: mocks.eq,
      }),
    }),
  },
}))

describe('useProfileStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('computes best/avg wpm, avg accuracy, and total runs from verified runs', async () => {
    mocks.eq.mockResolvedValue({
      data: [
        { wpm: 80, accuracy: 96 },
        { wpm: 100, accuracy: 100 },
        { wpm: 90, accuracy: 92 },
      ],
      error: null,
    })

    const { result } = renderHook(() => useProfileStats())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.stats).toEqual({
      totalRuns: 3,
      bestWpm: 100,
      avgWpm: 90,
      avgAccuracy: 96,
    })
    expect(result.current.error).toBeNull()
  })

  it('returns null stats (empty state) when there are no runs yet', async () => {
    mocks.eq.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useProfileStats())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.stats).toBeNull()
  })

  it('surfaces an error when the fetch fails', async () => {
    mocks.eq.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useProfileStats())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('boom')
  })
})
