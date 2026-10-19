import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAddBot } from './useAddBot'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}))

describe('useAddBot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds a bot with the requested personality and calls onAdded', async () => {
    mocks.invoke.mockResolvedValue({
      data: { id: 'bot-1', roomId: 'room-1', personality: 'coder' },
      error: null,
    })
    const onAdded = vi.fn()

    const { result } = renderHook(() => useAddBot())

    act(() => {
      result.current.addBot('room-1', 'coder', onAdded)
    })

    expect(result.current.adding).toBe(true)

    await waitFor(() => expect(result.current.adding).toBe(false))

    expect(mocks.invoke).toHaveBeenCalledWith('add-room-bot', {
      body: { roomId: 'room-1', personality: 'coder' },
    })
    expect(onAdded).toHaveBeenCalledOnce()
    expect(result.current.error).toBeNull()
  })

  it('omits personality from the request when not provided (server picks randomly)', async () => {
    mocks.invoke.mockResolvedValue({
      data: { id: 'bot-1', roomId: 'room-1', personality: 'typist' },
      error: null,
    })

    const { result } = renderHook(() => useAddBot())

    act(() => {
      result.current.addBot('room-1')
    })

    await waitFor(() => expect(result.current.adding).toBe(false))

    expect(mocks.invoke).toHaveBeenCalledWith('add-room-bot', {
      body: { roomId: 'room-1' },
    })
  })

  it('surfaces an error and does not call onAdded when adding fails', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { message: 'room is full' },
    })
    const onAdded = vi.fn()

    const { result } = renderHook(() => useAddBot())

    act(() => {
      result.current.addBot('room-1', 'coder', onAdded)
    })

    await waitFor(() => expect(result.current.adding).toBe(false))

    expect(result.current.error).toBe('room is full')
    expect(onAdded).not.toHaveBeenCalled()
  })
})
