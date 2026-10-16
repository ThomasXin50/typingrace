import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HeroKeyboard } from './HeroKeyboard'

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reducedMotion,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

function isPressed(letter: string) {
  return screen
    .getByText(letter)
    .closest('.hero-key')
    ?.className.includes('hero-key--pressed')
}

describe('HeroKeyboard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockMatchMedia(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is purely decorative - hidden from assistive tech', () => {
    const { container } = render(<HeroKeyboard />)

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders every letter across the three QWERTY rows', () => {
    render(<HeroKeyboard />)

    for (const letter of 'QWERTYUIOPASDFGHJKLZXCVBNM') {
      expect(screen.getByText(letter)).toBeInTheDocument()
    }
  })

  it('presses exactly one key at a time, stepping through the sequence, then pauses before looping', () => {
    render(<HeroKeyboard />)

    function anyPressed() {
      return document.querySelector('.hero-key--pressed')
    }

    // Starts on T (step 0).
    expect(isPressed('T')).toBe(true)

    advance(260)
    expect(isPressed('Y')).toBe(true)

    // ... P, I, N, G, T, E, S, T are steps 2-9; skip ahead to the pause.
    advance(260 * 8)
    expect(isPressed('T')).toBe(true)

    // The two trailing pause steps: nothing pressed.
    advance(260)
    expect(anyPressed()).toBeNull()
    advance(260)
    expect(anyPressed()).toBeNull()

    // Loops back to T.
    advance(260)
    expect(isPressed('T')).toBe(true)
  })

  it('never advances past the initial frame under prefers-reduced-motion', () => {
    mockMatchMedia(true)
    render(<HeroKeyboard />)

    expect(isPressed('T')).toBe(true)

    advance(260 * 20)

    expect(isPressed('T')).toBe(true)
  })
})
