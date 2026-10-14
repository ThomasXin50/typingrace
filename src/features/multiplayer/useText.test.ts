import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useText } from './useText'

const mocks = vi.hoisted(() => ({ maybeSingle: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mocks.maybeSingle,
        }),
      }),
    }),
  },
}))

describe('useText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads a text by id', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { content: 'the quick brown fox' },
      error: null,
    })

    const { result } = renderHook(() => useText('text-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.content).toBe('the quick brown fox')
    expect(result.current.error).toBeNull()
  })

  it('does not fetch when textId is null, and is not left loading forever', () => {
    const { result } = renderHook(() => useText(null))

    expect(result.current.loading).toBe(false)
    expect(result.current.content).toBeNull()
    expect(mocks.maybeSingle).not.toHaveBeenCalled()
  })

  it('surfaces an error when the fetch fails', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    })

    const { result } = renderHook(() => useText('text-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('boom')
  })
})
