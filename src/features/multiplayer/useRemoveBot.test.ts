import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRemoveBot } from './useRemoveBot'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}))

describe('useRemoveBot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('removes a bot and calls onRemoved', async () => {
    mocks.invoke.mockResolvedValue({ data: { removed: true }, error: null })
    const onRemoved = vi.fn()

    const { result } = renderHook(() => useRemoveBot())

    act(() => {
      result.current.removeBot('room-1', 'bot-1', onRemoved)
    })

    expect(result.current.removing).toBe(true)

    await waitFor(() => expect(result.current.removing).toBe(false))

    expect(mocks.invoke).toHaveBeenCalledWith('remove-room-bot', {
      body: { roomId: 'room-1', botId: 'bot-1' },
    })
    expect(onRemoved).toHaveBeenCalledOnce()
    expect(result.current.error).toBeNull()
  })

  it('surfaces an error and does not call onRemoved when removal fails', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { message: 'only the host can remove bots' },
    })
    const onRemoved = vi.fn()

    const { result } = renderHook(() => useRemoveBot())

    act(() => {
      result.current.removeBot('room-1', 'bot-1', onRemoved)
    })

    await waitFor(() => expect(result.current.removing).toBe(false))

    expect(result.current.error).toBe('only the host can remove bots')
    expect(onRemoved).not.toHaveBeenCalled()
  })
})
