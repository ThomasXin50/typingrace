import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStartRace } from './useStartRace'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}))

describe('useStartRace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts a race for a room', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        roundId: 'round-1',
        textContent: 'the quick brown fox',
        startedAt: '2026-01-01T00:00:05Z',
      },
      error: null,
    })

    const { result } = renderHook(() => useStartRace())

    act(() => {
      result.current.startRace('room-1')
    })

    expect(result.current.starting).toBe(true)

    await waitFor(() => expect(result.current.starting).toBe(false))

    expect(mocks.invoke).toHaveBeenCalledWith('start-race', {
      body: { roomId: 'room-1' },
    })
    expect(result.current.round?.roundId).toBe('round-1')
    expect(result.current.error).toBeNull()
  })

  it('surfaces an error, e.g. when a non-host tries to start', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { message: 'only the host can start the race' },
    })

    const { result } = renderHook(() => useStartRace())

    act(() => {
      result.current.startRace('room-1')
    })

    await waitFor(() => expect(result.current.starting).toBe(false))

    expect(result.current.error).toBe('only the host can start the race')
    expect(result.current.round).toBeNull()
  })
})
