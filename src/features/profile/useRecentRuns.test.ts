import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecentRuns } from './useRecentRuns'

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: mocks.limit,
        }),
      }),
    }),
  },
}))

describe('useRecentRuns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps the most recent runs into camelCase fields, most recent first', async () => {
    mocks.limit.mockResolvedValue({
      data: [
        {
          id: 'run-2',
          created_at: '2026-01-02T00:00:00.000Z',
          wpm: 90,
          raw_wpm: 95,
          accuracy: 96,
          error_count: 2,
          duration_ms: 12000,
          validation_status: 'verified',
        },
        {
          id: 'run-1',
          created_at: '2026-01-01T00:00:00.000Z',
          wpm: 80,
          raw_wpm: 88,
          accuracy: 90,
          error_count: 5,
          duration_ms: 15000,
          validation_status: 'flagged',
        },
      ],
      error: null,
    })

    const { result } = renderHook(() => useRecentRuns())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.runs).toEqual([
      {
        id: 'run-2',
        createdAt: '2026-01-02T00:00:00.000Z',
        wpm: 90,
        rawWpm: 95,
        accuracy: 96,
        errorCount: 2,
        durationMs: 12000,
        validationStatus: 'verified',
      },
      {
        id: 'run-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        wpm: 80,
        rawWpm: 88,
        accuracy: 90,
        errorCount: 5,
        durationMs: 15000,
        validationStatus: 'flagged',
      },
    ])
    expect(result.current.error).toBeNull()
  })

  it('returns an empty list when there are no runs yet', async () => {
    mocks.limit.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useRecentRuns())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.runs).toEqual([])
  })

  it('surfaces an error when the fetch fails', async () => {
    mocks.limit.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useRecentRuns())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('boom')
    expect(result.current.runs).toEqual([])
  })
})
