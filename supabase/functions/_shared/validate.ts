export interface Keystroke {
  key: string
  timestamp: number
  trusted: boolean
}

export interface TypingStats {
  wpm: number
  rawWpm: number
  accuracy: number
  durationMs: number
  errorCount: number
  finished: boolean
}

export type ValidationStatus = 'verified' | 'flagged' | 'rejected'

export interface ValidationResult {
  status: ValidationStatus
  reason?: string
}

const WORD_LENGTH = 5
const WPM_CEILING = 250
const MIN_INTERVALS_FOR_TIMING_CHECK = 10
const SUSPICIOUSLY_UNIFORM_CV = 0.15

/**
 * Replays a raw keystroke log against the known text, mirroring the
 * frontend engine's continue-through-errors model exactly: once the text
 * is completed, every later event (including a trailing backspace) is
 * locked out, matching the client's own finish guard.
 */
export function computeStats(
  text: string,
  keystrokes: Keystroke[],
  startTimestamp?: number,
): TypingStats {
  let typed = ''
  let totalKeystrokes = 0
  let mistakeCount = 0
  let firstTimestamp: number | null = null
  let finishTimestamp: number | null = null

  for (const ks of keystrokes) {
    if (finishTimestamp !== null) break
    if (firstTimestamp === null) firstTimestamp = ks.timestamp

    if (ks.key === 'Backspace') {
      typed = typed.slice(0, -1)
      continue
    }
    if (ks.key.length !== 1) continue

    totalKeystrokes += 1
    if (ks.key !== text[typed.length]) mistakeCount += 1
    typed += ks.key

    if (typed.length === text.length) {
      finishTimestamp = ks.timestamp
    }
  }

  const finished = finishTimestamp !== null
  // A race measures elapsed time from the synchronized start, not this
  // player's own first keystroke - mirrors useTypingEngine's identical
  // startTimestamp option on the client, so the server's anti-cheat
  // verdict is computed against the same duration the player was shown.
  const effectiveStart = startTimestamp ?? firstTimestamp
  const durationMs =
    finished && effectiveStart !== null ? finishTimestamp! - effectiveStart : 0
  const minutes = durationMs / 60_000

  let correctChars = 0
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === text[i]) correctChars += 1
  }

  return {
    wpm: minutes > 0 ? correctChars / WORD_LENGTH / minutes : 0,
    rawWpm: minutes > 0 ? totalKeystrokes / WORD_LENGTH / minutes : 0,
    accuracy:
      totalKeystrokes > 0
        ? ((totalKeystrokes - mistakeCount) / totalKeystrokes) * 100
        : 100,
    durationMs,
    errorCount: mistakeCount,
    finished,
  }
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function coefficientOfVariation(intervals: number[]): number {
  const m = mean(intervals)
  if (m === 0) return 0
  const variance = mean(intervals.map((v) => (v - m) ** 2))
  return Math.sqrt(variance) / m
}

/**
 * Anomaly checks, applied only once a run is otherwise plausible. A
 * non-trusted (scripted) event is treated as definitive bot evidence and
 * rejected outright; everything else is ambiguous and only flagged for
 * review, mirroring TypeRacer's "confirm via challenge" pattern rather than
 * a silent ban.
 */
export function assessValidation(
  keystrokes: Keystroke[],
  stats: TypingStats,
): ValidationResult {
  if (!stats.finished) {
    return {
      status: 'rejected',
      reason: 'run never reached the end of the text',
    }
  }

  if (keystrokes.some((k) => !k.trusted)) {
    return {
      status: 'rejected',
      reason: 'untrusted (scripted) keystroke detected',
    }
  }

  if (stats.durationMs <= 0) {
    // Not a "slow" run (which wpm would correctly flag) - zero elapsed
    // time between the first and finishing keystroke means every
    // timestamp collapsed to one instant, which isn't how typing works.
    return { status: 'rejected', reason: 'zero elapsed duration' }
  }

  if (stats.wpm > WPM_CEILING) {
    return { status: 'flagged', reason: 'wpm exceeds plausible ceiling' }
  }

  const intervals: number[] = []
  for (let i = 1; i < keystrokes.length; i++) {
    intervals.push(keystrokes[i].timestamp - keystrokes[i - 1].timestamp)
  }

  if (
    intervals.length >= MIN_INTERVALS_FOR_TIMING_CHECK &&
    coefficientOfVariation(intervals) < SUSPICIOUSLY_UNIFORM_CV
  ) {
    return {
      status: 'flagged',
      reason: 'keystroke timing is suspiciously uniform',
    }
  }

  return { status: 'verified' }
}
