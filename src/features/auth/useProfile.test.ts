import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProfile } from './useProfile'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
  single: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      signInAnonymously: mocks.signInAnonymously,
    },
    from: () => ({
      select: () => ({
        eq: () => ({ single: mocks.single }),
      }),
    }),
  },
}))

describe('useProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signs in anonymously when there is no existing session', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    mocks.signInAnonymously.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mocks.single.mockResolvedValue({
      data: { id: 'user-1', username: 'user_abc123' },
      error: null,
    })

    const { result } = renderHook(() => useProfile())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mocks.signInAnonymously).toHaveBeenCalledOnce()
    expect(result.current.profile).toEqual({
      id: 'user-1',
      username: 'user_abc123',
    })
    expect(result.current.error).toBeNull()
  })

  it('reuses an existing session without signing in again', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-2' } } },
    })
    mocks.single.mockResolvedValue({
      data: { id: 'user-2', username: 'alice' },
      error: null,
    })

    const { result } = renderHook(() => useProfile())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mocks.signInAnonymously).not.toHaveBeenCalled()
    expect(result.current.profile).toEqual({ id: 'user-2', username: 'alice' })
  })

  it('surfaces an error when the profile fetch fails', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-3' } } },
    })
    mocks.single.mockResolvedValue({
      data: null,
      error: { message: 'profile not found' },
    })

    const { result } = renderHook(() => useProfile())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.profile).toBeNull()
    expect(result.current.error).toBe('profile not found')
  })

  it('surfaces an error when anonymous sign-in fails', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    mocks.signInAnonymously.mockResolvedValue({
      data: { user: null },
      error: { message: 'sign-in failed' },
    })

    const { result } = renderHook(() => useProfile())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.profile).toBeNull()
    expect(result.current.error).toBe('sign-in failed')
  })
})
