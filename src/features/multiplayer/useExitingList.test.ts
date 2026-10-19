import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useExitingList } from './useExitingList'

interface Item {
  id: string
  label: string
}

const getKey = (item: Item) => item.id

describe('useExitingList', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with every initial item present, nothing leaving', () => {
    const items: Item[] = [
      { id: 'a', label: 'Alice' },
      { id: 'b', label: 'Bob' },
    ]
    const { result } = renderHook(() => useExitingList(items, getKey, 250))

    expect(result.current).toEqual([
      { key: 'a', item: items[0], leaving: false },
      { key: 'b', item: items[1], leaving: false },
    ])
  })

  it('appends a newly added item as present, keeping existing ones in place', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useExitingList(items, getKey, 250),
      { initialProps: { items: [{ id: 'a', label: 'Alice' }] } },
    )

    rerender({
      items: [
        { id: 'a', label: 'Alice' },
        { id: 'b', label: 'Bob' },
      ],
    })

    expect(result.current.map((e) => [e.key, e.leaving])).toEqual([
      ['a', false],
      ['b', false],
    ])
  })

  it('keeps a removed item rendered with leaving:true, then drops it once the exit duration elapses', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useExitingList(items, getKey, 250),
      {
        initialProps: {
          items: [
            { id: 'a', label: 'Alice' },
            { id: 'b', label: 'Bob' },
          ],
        },
      },
    )

    rerender({ items: [{ id: 'a', label: 'Alice' }] })

    // Bob is gone from the source data but still rendered, flagged leaving.
    expect(result.current.map((e) => [e.key, e.leaving])).toEqual([
      ['a', false],
      ['b', true],
    ])

    act(() => {
      vi.advanceTimersByTime(249)
    })
    expect(result.current.map((e) => e.key)).toEqual(['a', 'b'])

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.map((e) => e.key)).toEqual(['a'])
  })

  it('revives an item that reappears before its exit timer elapses, cancelling the removal', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useExitingList(items, getKey, 250),
      {
        initialProps: {
          items: [
            { id: 'a', label: 'Alice' },
            { id: 'b', label: 'Bob' },
          ],
        },
      },
    )

    rerender({ items: [{ id: 'a', label: 'Alice' }] })
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Bob reappears (e.g. a flaky reconnect) before the 250ms exit elapses.
    rerender({
      items: [
        { id: 'a', label: 'Alice' },
        { id: 'b', label: 'Bob' },
      ],
    })

    expect(result.current.map((e) => [e.key, e.leaving])).toEqual([
      ['a', false],
      ['b', false],
    ])

    // The cancelled timer must not fire later and remove the revived item.
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current.map((e) => e.key)).toEqual(['a', 'b'])
  })

  it('clears pending exit timers on unmount, rather than leaking them', () => {
    const { rerender, unmount } = renderHook(
      ({ items }) => useExitingList(items, getKey, 250),
      {
        initialProps: {
          items: [
            { id: 'a', label: 'Alice' },
            { id: 'b', label: 'Bob' },
          ],
        },
      },
    )

    rerender({ items: [{ id: 'a', label: 'Alice' }] })
    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})
