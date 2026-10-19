import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRandomText } from './useRandomText'

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: mocks.eq,
      }),
    }),
  },
}))

describe('useRandomText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads approved texts and picks one', async () => {
    mocks.eq.mockResolvedValue({
      data: [
        { id: 'a', content: 'text a' },
        { id: 'b', content: 'text b' },
      ],
      error: null,
    })

    const { result } = renderHook(() => useRandomText())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.text).toEqual({ id: 'a', content: 'text a' })
    expect(result.current.error).toBeNull()
  })

  it('surfaces an error when the fetch fails', async () => {
    mocks.eq.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useRandomText())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.text).toBeNull()
    expect(result.current.error).toBe('boom')
  })

  it('surfaces an error when there are no approved texts', async () => {
    mocks.eq.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useRandomText())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('No approved texts are available')
  })

  it('requestNext picks a different text when more than one is available', async () => {
    mocks.eq.mockResolvedValue({
      data: [
        { id: 'a', content: 'text a' },
        { id: 'b', content: 'text b' },
      ],
      error: null,
    })

    const { result } = renderHook(() => useRandomText())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.text?.id).toBe('a')

    act(() => result.current.requestNext())

    expect(result.current.text?.id).toBe('b')
  })

  it('requestNext advances selectionKey even with only one text available', async () => {
    mocks.eq.mockResolvedValue({
      data: [{ id: 'a', content: 'text a' }],
      error: null,
    })

    const { result } = renderHook(() => useRandomText())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const keyAfterLoad = result.current.selectionKey

    act(() => result.current.requestNext())

    // The text itself is unavoidably the same (it's the only one), but the
    // selection key must still change so callers can force a fresh run.
    expect(result.current.text?.id).toBe('a')
    expect(result.current.selectionKey).not.toBe(keyAfterLoad)
  })

  it('selectionKey advances on every requestNext call, not just when the text changes', async () => {
    mocks.eq.mockResolvedValue({
      data: [
        { id: 'a', content: 'text a' },
        { id: 'b', content: 'text b' },
      ],
      error: null,
    })

    const { result } = renderHook(() => useRandomText())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const keyAfterLoad = result.current.selectionKey

    act(() => result.current.requestNext())
    const keyAfterFirstNext = result.current.selectionKey
    act(() => result.current.requestNext())

    expect(keyAfterFirstNext).not.toBe(keyAfterLoad)
    expect(result.current.selectionKey).not.toBe(keyAfterFirstNext)
  })
})
