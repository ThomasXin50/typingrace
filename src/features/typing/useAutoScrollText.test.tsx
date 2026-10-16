import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoScrollText } from './useAutoScrollText'

const LINE_HEIGHT = 20

// jsdom does no real layout, so line position can't come from an actual
// browser wrap - instead each span is pinned to a fake `top` (via a
// mocked getBoundingClientRect) representing which line it would have
// wrapped onto, exercising the same measure-the-DOM path the real
// component uses without needing a real browser.
function Harness({
  currentIndex,
  lineOfChar,
}: {
  currentIndex: number
  lineOfChar: number[]
}) {
  const { viewportRef, textRef, clipped, heightPx, offsetPx } =
    useAutoScrollText(currentIndex)

  return (
    <div ref={viewportRef}>
      <div ref={textRef}>
        {lineOfChar.map((line, i) => (
          <span
            key={i}
            data-top={line * LINE_HEIGHT}
            className={
              i === currentIndex
                ? 'typing-char--current'
                : 'typing-char--pending'
            }
          />
        ))}
      </div>
      <output data-testid="result">
        {JSON.stringify({ clipped, heightPx, offsetPx })}
      </output>
    </div>
  )
}

function readResult() {
  return JSON.parse(screen.getByTestId('result').textContent ?? '{}')
}

describe('useAutoScrollText', () => {
  beforeEach(() => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () => ({ lineHeight: `${LINE_HEIGHT}px` }) as CSSStyleDeclaration,
    )
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        const top = this.dataset.top ? Number(this.dataset.top) : 0
        return {
          top,
          bottom: top,
          left: 0,
          right: 0,
          width: 0,
          height: 0,
          x: 0,
          y: top,
          toJSON() {},
        } as DOMRect
      },
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is not clipped while the text fits within the visible window', () => {
    // 6 chars, 3 per line -> 2 lines total.
    const lineOfChar = [0, 0, 0, 1, 1, 1]
    render(<Harness currentIndex={0} lineOfChar={lineOfChar} />)

    expect(readResult()).toEqual({ clipped: false, heightPx: 0, offsetPx: 0 })
  })

  it('clips to a 3-line window once the text exceeds it, even before any scrolling is needed', () => {
    // 15 chars, 3 per line -> 5 lines total.
    const lineOfChar = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]
    render(<Harness currentIndex={0} lineOfChar={lineOfChar} />)

    expect(readResult()).toEqual({
      clipped: true,
      heightPx: LINE_HEIGHT * 3,
      offsetPx: 0,
    })
  })

  it('scrolls down one line at a time as the active character crosses past the visible window', () => {
    const lineOfChar = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]
    const { rerender } = render(
      <Harness currentIndex={0} lineOfChar={lineOfChar} />,
    )

    // Index 9 is on line 3 - one past the initial 0-2 window.
    rerender(<Harness currentIndex={9} lineOfChar={lineOfChar} />)
    expect(readResult().offsetPx).toBe(LINE_HEIGHT * 1)

    // Index 12 is on line 4 - one further.
    rerender(<Harness currentIndex={12} lineOfChar={lineOfChar} />)
    expect(readResult().offsetPx).toBe(LINE_HEIGHT * 2)
  })

  it('snaps straight back up if backspacing moves the active character above the visible window', () => {
    const lineOfChar = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]
    const { rerender } = render(
      <Harness currentIndex={12} lineOfChar={lineOfChar} />,
    )
    expect(readResult().offsetPx).toBe(LINE_HEIGHT * 2)

    rerender(<Harness currentIndex={0} lineOfChar={lineOfChar} />)
    expect(readResult().offsetPx).toBe(0)
  })
})
