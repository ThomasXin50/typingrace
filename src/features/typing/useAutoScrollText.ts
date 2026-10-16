import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { nextScrollOffset, VISIBLE_LINES } from './autoScrollText'

interface AutoScrollText {
  viewportRef: RefObject<HTMLDivElement | null>
  textRef: RefObject<HTMLDivElement | null>
  clipped: boolean
  heightPx: number
  offsetPx: number
}

/**
 * Keeps the typing text's active character inside a 3-line viewport,
 * clipping and auto-scrolling once the text is long enough to exceed it.
 * Which line a character lands on can't be derived from its index alone -
 * it depends on where the browser actually wraps the text at the current
 * width - so this measures rendered span positions directly rather than
 * guessing from character counts.
 */
export function useAutoScrollText(currentIndex: number): AutoScrollText {
  const viewportRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const [lineHeightPx, setLineHeightPx] = useState(0)
  const [totalLines, setTotalLines] = useState(1)
  const [scrollOffsetLines, setScrollOffsetLines] = useState(0)

  function measure() {
    const textEl = textRef.current
    if (!textEl) return

    const lineHeight = parseFloat(getComputedStyle(textEl).lineHeight)
    if (!lineHeight) return
    setLineHeightPx(lineHeight)

    const containerTop = textEl.getBoundingClientRect().top
    const lastChar = textEl.lastElementChild as HTMLElement | null
    if (!lastChar) return

    const lastTop = lastChar.getBoundingClientRect().top - containerTop
    setTotalLines(Math.round(lastTop / lineHeight) + 1)

    // No character carries the 'current' class once the run is finished
    // (the status array has no index past the end) - fall back to the
    // last character so the window stays put on the final line instead
    // of losing its measurement.
    const currentChar =
      (textEl.querySelector('.typing-char--current') as HTMLElement | null) ??
      lastChar
    const currentTop = currentChar.getBoundingClientRect().top - containerTop
    const currentLine = Math.round(currentTop / lineHeight)
    setScrollOffsetLines((prev) =>
      nextScrollOffset(currentLine, prev, VISIBLE_LINES),
    )
  }

  // Re-measure whenever the active character moves - forward on a
  // keystroke, or back up on a backspace.
  useLayoutEffect(measure, [currentIndex])

  // Wrapping depends on rendered width, not just character count - a
  // viewport resize can change which line everything lands on even
  // though the text itself hasn't changed.
  useLayoutEffect(() => {
    const target = viewportRef.current
    if (!target || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(measure)
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  const clipped = totalLines > VISIBLE_LINES

  return {
    viewportRef,
    textRef,
    clipped,
    heightPx: clipped ? lineHeightPx * VISIBLE_LINES : 0,
    offsetPx: scrollOffsetLines * lineHeightPx,
  }
}
