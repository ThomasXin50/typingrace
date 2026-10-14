import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useJoinRoom } from './useJoinRoom'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}))

describe('useJoinRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('joins a room by code', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        id: 'room-1',
        joinCode: 'ABC123',
        maxPlayers: 8,
        difficultyFilter: 'all',
        status: 'lobby',
        hostId: 'host',
      },
      error: null,
    })

    const { result } = renderHook(() => useJoinRoom())

    act(() => {
      result.current.joinRoom('abc123')
    })

    expect(result.current.joining).toBe(true)

    await waitFor(() => expect(result.current.joining).toBe(false))

    expect(mocks.invoke).toHaveBeenCalledWith('join-room', {
      body: { joinCode: 'abc123' },
    })
    expect(result.current.room?.id).toBe('room-1')
    expect(result.current.error).toBeNull()
  })

  it('surfaces an error for an unknown code', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { message: 'room not found' },
    })

    const { result } = renderHook(() => useJoinRoom())

    act(() => {
      result.current.joinRoom('ZZZZZZ')
    })

    await waitFor(() => expect(result.current.joining).toBe(false))

    expect(result.current.error).toBe('room not found')
    expect(result.current.room).toBeNull()
  })
})
