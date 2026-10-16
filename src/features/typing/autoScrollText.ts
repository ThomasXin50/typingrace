export const VISIBLE_LINES = 3

/**
 * Where the text's scroll window should sit so the current line stays
 * inside the visible window - scrolling down by exactly enough once
 * typing crosses past the bottom, and snapping straight back up if the
 * current line ends up above the top (e.g. backspacing past it), rather
 * than only ever creeping forward.
 */
export function nextScrollOffset(
  currentLine: number,
  scrollOffsetLines: number,
  visibleLines: number = VISIBLE_LINES,
): number {
  if (currentLine < scrollOffsetLines) return currentLine
  if (currentLine > scrollOffsetLines + visibleLines - 1) {
    return currentLine - visibleLines + 1
  }
  return scrollOffsetLines
}
