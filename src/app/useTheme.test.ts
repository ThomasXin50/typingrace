import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useTheme } from './useTheme'

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  afterEach(() => {
    delete document.documentElement.dataset.theme
  })

  it('defaults to "system" with no stored preference and no data-theme attribute', () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current.preference).toBe('system')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('reads a previously stored preference on mount', () => {
    localStorage.setItem('theme-preference', 'dark')

    const { result } = renderHook(() => useTheme())

    expect(result.current.preference).toBe('dark')
  })

  it('setting a preference persists it and applies the data-theme attribute', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setPreference('dark'))

    expect(result.current.preference).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme-preference')).toBe('dark')
  })

  it('setting "system" clears the data-theme attribute', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setPreference('light'))
    act(() => result.current.setPreference('system'))

    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem('theme-preference')).toBe('system')
  })

  it('ignores a malformed stored value and falls back to "system"', () => {
    localStorage.setItem('theme-preference', 'not-a-real-theme')

    const { result } = renderHook(() => useTheme())

    expect(result.current.preference).toBe('system')
  })
})
