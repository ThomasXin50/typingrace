import { describe, expect, it } from 'vitest'
import { nextScrollOffset, VISIBLE_LINES } from './autoScrollText'

describe('nextScrollOffset', () => {
  it('stays put while the current line is anywhere inside the visible window', () => {
    expect(nextScrollOffset(0, 0, 3)).toBe(0)
    expect(nextScrollOffset(1, 0, 3)).toBe(0)
    expect(nextScrollOffset(2, 0, 3)).toBe(0)
    expect(nextScrollOffset(5, 3, 3)).toBe(3)
  })

  it('scrolls down by exactly enough to make the current line the last visible one once it moves past the window', () => {
    expect(nextScrollOffset(3, 0, 3)).toBe(1)
    expect(nextScrollOffset(4, 0, 3)).toBe(2)
  })

  it('advances one line at a time as typing continues past the window, matching natural one-char-per-keystroke progress', () => {
    let offset = 0
    offset = nextScrollOffset(3, offset, 3)
    expect(offset).toBe(1)
    offset = nextScrollOffset(4, offset, 3)
    expect(offset).toBe(2)
    offset = nextScrollOffset(5, offset, 3)
    expect(offset).toBe(3)
  })

  it('snaps straight back up if the current line sits above the window - e.g. backspacing past its top', () => {
    expect(nextScrollOffset(0, 2, 3)).toBe(0)
    expect(nextScrollOffset(1, 5, 3)).toBe(1)
  })

  it('defaults the visible-line count to VISIBLE_LINES when not given', () => {
    expect(VISIBLE_LINES).toBe(3)
    expect(nextScrollOffset(3, 0)).toBe(1)
  })
})
