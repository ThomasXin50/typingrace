import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStallRoundParticipant } from './useStallRoundParticipant'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}))

describe('useStallRoundParticipant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports this player as stalled for the given round', async () => {
    mocks.invoke.mockResolvedValue({ data: { status: 'stalled' }, error: null })

    const { result } = renderHook(() => useStallRoundParticipant())

    act(() => {
      result.current.stall('round-1')
    })

    expect(result.current.stalling).toBe(true)

    await waitFor(() => expect(result.current.stalling).toBe(false))

    expect(mocks.invoke).toHaveBeenCalledWith('stall-round-participant', {
      body: { roundId: 'round-1' },
    })
    expect(result.current.error).toBeNull()
  })

  it('surfaces an error when the function call fails', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useStallRoundParticipant())

    act(() => {
      result.current.stall('round-1')
    })

    await waitFor(() => expect(result.current.stalling).toBe(false))

    expect(result.current.error).toBe('boom')
  })
})
