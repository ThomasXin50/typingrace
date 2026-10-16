import { describe, expect, it } from 'vitest'
import { PRESS_SEQUENCE, buildKeyLayout } from './heroKeyboardLayout'

describe('PRESS_SEQUENCE', () => {
  it('spells "typingtest", including the three reuses of the same T key', () => {
    const letters = PRESS_SEQUENCE.filter((l) => l !== null).join('')

    expect(letters.toLowerCase()).toBe('typingtest')
  })

  it('pauses on two steps with nothing pressed after the last T, before looping', () => {
    expect(PRESS_SEQUENCE.slice(-2)).toEqual([null, null])
    expect(PRESS_SEQUENCE.at(-3)).toBe('T')
  })
})

describe('buildKeyLayout', () => {
  it('includes exactly the three QWERTY letter rows, one entry per key', () => {
    const layout = buildKeyLayout()

    expect(layout.map((k) => k.letter).join('')).toBe(
      'QWERTYUIOPASDFGHJKLZXCVBNM',
    )
  })

  it('every letter PRESS_SEQUENCE needs is present on the keyboard', () => {
    const letters = new Set(buildKeyLayout().map((k) => k.letter))

    for (const letter of PRESS_SEQUENCE) {
      if (letter === null) continue
      expect(letters.has(letter)).toBe(true)
    }
  })

  it('centers the whole layout on its own bounding box', () => {
    const layout = buildKeyLayout()
    const txs = layout.map((k) => k.tx)
    const tys = layout.map((k) => k.ty)

    expect(Math.min(...txs) + Math.max(...txs)).toBeCloseTo(0)
    expect(Math.min(...tys) + Math.max(...tys)).toBeCloseTo(0)
  })

  it('keeps each row at a single consistent depth, nearer rows further down', () => {
    const layout = buildKeyLayout()
    const byLetter = Object.fromEntries(layout.map((k) => [k.letter, k.ty]))

    // QWERTY row (farthest) above the home row, home row above the
    // bottom row (nearest) - increasing ty is "further down the keyboard,
    // toward the typist" in this layout's local coordinate space.
    expect(byLetter.Q).toBe(byLetter.P)
    expect(byLetter.A).toBe(byLetter.L)
    expect(byLetter.Z).toBe(byLetter.M)
    expect(byLetter.Q).toBeLessThan(byLetter.A)
    expect(byLetter.A).toBeLessThan(byLetter.Z)
  })

  it('orders keys left to right within a row by increasing tx', () => {
    const layout = buildKeyLayout()
    const byLetter = Object.fromEntries(layout.map((k) => [k.letter, k.tx]))

    expect(byLetter.Q).toBeLessThan(byLetter.W)
    expect(byLetter.W).toBeLessThan(byLetter.P)
  })
})
