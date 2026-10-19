import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCreateRoom } from './useCreateRoom'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}))

describe('useCreateRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a room and surfaces its join code', async () => {
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

    const { result } = renderHook(() => useCreateRoom())

    act(() => {
      result.current.createRoom({ maxPlayers: 4 })
    })

    expect(result.current.creating).toBe(true)

    await waitFor(() => expect(result.current.creating).toBe(false))

    expect(mocks.invoke).toHaveBeenCalledWith('create-room', {
      body: { maxPlayers: 4 },
    })
    expect(result.current.room?.joinCode).toBe('ABC123')
    expect(result.current.error).toBeNull()
  })

  it('surfaces an error when creation fails', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useCreateRoom())

    act(() => {
      result.current.createRoom()
    })

    await waitFor(() => expect(result.current.creating).toBe(false))

    expect(result.current.error).toBe('boom')
    expect(result.current.room).toBeNull()
  })
})
