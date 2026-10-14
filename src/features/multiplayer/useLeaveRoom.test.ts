import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLeaveRoom } from './useLeaveRoom'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}))

describe('useLeaveRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('leaves a room and calls onLeft', async () => {
    mocks.invoke.mockResolvedValue({
      data: { left: true, roomDeleted: false },
      error: null,
    })
    const onLeft = vi.fn()

    const { result } = renderHook(() => useLeaveRoom())

    act(() => {
      result.current.leaveRoom('room-1', onLeft)
    })

    expect(result.current.leaving).toBe(true)

    await waitFor(() => expect(result.current.leaving).toBe(false))

    expect(mocks.invoke).toHaveBeenCalledWith('leave-room', {
      body: { roomId: 'room-1' },
    })
    expect(onLeft).toHaveBeenCalledOnce()
    expect(result.current.error).toBeNull()
  })

  it('surfaces an error and does not call onLeft when leaving fails', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const onLeft = vi.fn()

    const { result } = renderHook(() => useLeaveRoom())

    act(() => {
      result.current.leaveRoom('room-1', onLeft)
    })

    await waitFor(() => expect(result.current.leaving).toBe(false))

    expect(result.current.error).toBe('boom')
    expect(onLeft).not.toHaveBeenCalled()
  })
})
