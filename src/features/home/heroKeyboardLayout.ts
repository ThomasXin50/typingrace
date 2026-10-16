const ROWS = [
  { y: 0, startCol: 1.5, keys: 'QWERTYUIOP' },
  { y: 1, startCol: 1.75, keys: 'ASDFGHJKL' },
  { y: 2, startCol: 2.25, keys: 'ZXCVBNM' },
]

export const UNIT = 42
export const KEY_SIZE = 36
export const CAP_HEIGHT = 12

// The same physical T key gets pressed three times (steps 0, 6, 9) -
// spelled out in full rather than deduplicated so the animation can just
// walk it in order with no special-casing. Two trailing `null` steps hold
// nothing down after the final T, so the loop pauses on an at-rest
// keyboard before spelling it out again.
export const PRESS_SEQUENCE: readonly (string | null)[] = [
  'T',
  'Y',
  'P',
  'I',
  'N',
  'G',
  'T',
  'E',
  'S',
  'T',
  null,
  null,
]

export interface HeroKey {
  letter: string
  tx: number
  ty: number
}

/**
 * Real QWERTY column stagger and row depth, centered on the overall
 * bounding box so the whole layout sits at the scene's local origin
 * regardless of how the row/column constants above change.
 */
export function buildKeyLayout(): HeroKey[] {
  const raw = ROWS.flatMap((row) =>
    [...row.keys].map((letter, i) => ({
      letter,
      x: (row.startCol + i) * UNIT,
      y: row.y * UNIT,
    })),
  )

  const xs = raw.map((k) => k.x)
  const ys = raw.map((k) => k.y)
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2

  return raw.map((k) => ({
    letter: k.letter,
    tx: k.x - centerX,
    ty: k.y - centerY,
  }))
}
