import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTypingEngine } from './useTypingEngine'

describe('useTypingEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts idle with every character pending except the first', () => {
    const { result } = renderHook(() => useTypingEngine('abc'))

    expect(result.current.status).toBe('idle')
    expect(result.current.charStatuses).toEqual([
      'current',
      'pending',
      'pending',
    ])
    expect(result.current.stats).toBeNull()
  })

  it('marks correct and incorrect characters while typing, continuing through errors', () => {
    const { result } = renderHook(() => useTypingEngine('abc'))

    act(() => result.current.handleChange('a'))
    expect(result.current.status).toBe('running')
    expect(result.current.charStatuses).toEqual([
      'correct',
      'current',
      'pending',
    ])

    act(() => result.current.handleChange('ax'))
    expect(result.current.charStatuses).toEqual([
      'correct',
      'incorrect',
      'current',
    ])
  })

  it('removes the last character on backspace without counting it as a new keystroke', () => {
    const { result } = renderHook(() => useTypingEngine('abc'))

    act(() => result.current.handleChange('ax'))
    act(() => result.current.handleChange('a'))

    expect(result.current.typed).toBe('a')
    expect(result.current.charStatuses).toEqual([
      'correct',
      'current',
      'pending',
    ])
  })

  it('finishes when typed length reaches the text length and computes stats', () => {
    const text = 'a'.repeat(25) // 25 chars = 5 "words" at 5 chars/word
    const { result } = renderHook(() => useTypingEngine(text))

    act(() => result.current.handleChange('a')) // starts the clock at t=0
    vi.setSystemTime(60_000) // exactly one minute later
    act(() => result.current.handleChange(text))

    expect(result.current.status).toBe('finished')
    expect(result.current.stats).toEqual({
      wpm: 5,
      rawWpm: 5,
      accuracy: 100,
      durationMs: 60_000,
      errorCount: 0,
    })
  })

  it('counts a corrected mistake toward error count and accuracy', () => {
    const { result } = renderHook(() => useTypingEngine('ab'))

    act(() => result.current.handleChange('x')) // mistake: 1 keystroke, 1 error
    act(() => result.current.handleChange('')) // backspace, not a keystroke
    act(() => result.current.handleChange('a')) // correct: 2nd keystroke
    act(() => result.current.handleChange('ab')) // correct: 3rd keystroke, finishes

    expect(result.current.status).toBe('finished')
    expect(result.current.stats?.errorCount).toBe(1)
    expect(result.current.stats?.accuracy).toBeCloseTo((2 / 3) * 100)
  })

  it('ignores further input once finished', () => {
    const { result } = renderHook(() => useTypingEngine('ab'))

    act(() => result.current.handleChange('ab'))
    const statsAfterFinish = result.current.stats

    act(() => result.current.handleChange('abc'))

    expect(result.current.typed).toBe('ab')
    expect(result.current.stats).toEqual(statsAfterFinish)
  })

  it('reset returns to the idle state', () => {
    const { result } = renderHook(() => useTypingEngine('ab'))

    act(() => result.current.handleChange('ab'))
    act(() => result.current.reset())

    expect(result.current.status).toBe('idle')
    expect(result.current.typed).toBe('')
    expect(result.current.stats).toBeNull()
  })
})
