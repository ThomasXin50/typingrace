import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSubmitBotRun } from './useSubmitBotRun'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}))

describe('useSubmitBotRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submits a bot run and resolves with the assigned placement', async () => {
    mocks.invoke.mockResolvedValue({
      data: { placement: 1, fieldSize: 2 },
      error: null,
    })

    const { result } = renderHook(() => useSubmitBotRun())

    act(() => {
      result.current.submitBotRun('round-1', 'bot-1', {
        wpm: 72,
        rawWpm: 75,
        accuracy: 97,
        errorCount: 3,
      })
    })

    expect(mocks.invoke).toHaveBeenCalledWith('submit-bot-run', {
      body: {
        roundId: 'round-1',
        botId: 'bot-1',
        wpm: 72,
        rawWpm: 75,
        accuracy: 97,
        errorCount: 3,
      },
    })

    await waitFor(() => expect(result.current.error).toBeNull())
  })

  it('surfaces an error without throwing when submission fails', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { message: 'bot not found' },
    })

    const { result } = renderHook(() => useSubmitBotRun())

    act(() => {
      result.current.submitBotRun('round-1', 'bot-1', {
        wpm: 72,
        rawWpm: 75,
        accuracy: 97,
        errorCount: 3,
      })
    })

    await waitFor(() => expect(result.current.error).toBe('bot not found'))
  })
})
