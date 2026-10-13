import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSubmitRun } from './useSubmitRun'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: mocks.invoke,
    },
  },
}))

describe('useSubmitRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submits the keystroke log and surfaces the validation result', async () => {
    mocks.invoke.mockResolvedValue({
      data: { status: 'verified' },
      error: null,
    })

    const { result } = renderHook(() => useSubmitRun())

    act(() => {
      result.current.submit('text-1', [
        { key: 'a', timestamp: 0, trusted: true },
      ])
    })

    expect(result.current.submitting).toBe(true)

    await waitFor(() => expect(result.current.submitting).toBe(false))

    expect(mocks.invoke).toHaveBeenCalledWith('submit-solo-run', {
      body: {
        textId: 'text-1',
        keystrokes: [{ key: 'a', timestamp: 0, trusted: true }],
      },
    })
    expect(result.current.result).toEqual({ status: 'verified' })
    expect(result.current.error).toBeNull()
  })

  it('surfaces an error when the function call fails', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useSubmitRun())

    act(() => {
      result.current.submit('text-1', [])
    })

    await waitFor(() => expect(result.current.submitting).toBe(false))

    expect(result.current.error).toBe('boom')
    expect(result.current.result).toBeNull()
  })
})
