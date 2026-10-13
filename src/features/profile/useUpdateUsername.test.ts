import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUpdateUsername } from './useUpdateUsername'

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: mocks.eq,
      }),
    }),
  },
}))

describe('useUpdateUsername', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates the username and reports success', async () => {
    mocks.eq.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useUpdateUsername())

    act(() => {
      result.current.update('user-1', 'newname')
    })

    expect(result.current.submitting).toBe(true)

    await waitFor(() => expect(result.current.submitting).toBe(false))

    expect(result.current.success).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('surfaces an error when the update fails', async () => {
    mocks.eq.mockResolvedValue({ error: { message: 'username taken' } })

    const { result } = renderHook(() => useUpdateUsername())

    act(() => {
      result.current.update('user-1', 'newname')
    })

    await waitFor(() => expect(result.current.submitting).toBe(false))

    expect(result.current.success).toBe(false)
    expect(result.current.error).toBe('username taken')
  })
})
