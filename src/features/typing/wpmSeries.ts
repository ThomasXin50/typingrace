import type { Keystroke } from './useTypingEngine'

export interface WpmPoint {
  timeSec: number
  /** Error-adjusted (net) wpm - only correctly-placed characters count,
   * matching useTypingEngine's headline wpm stat. The default view. */
  wpm: number
  /** Every keystroke that advanced the cursor counts, correct or not -
   * matching useTypingEngine's headline rawWpm stat. */
  rawWpm: number
}

const BUCKET_MS = 1000
const MIN_DURATION_MS = BUCKET_MS * 3
const WORD_LENGTH = 5

interface TracePoint {
  timestamp: number
  typedLength: number
  correctLength: number
}

function valueAtOrBefore(
  trace: TracePoint[],
  t: number,
  field: 'typedLength' | 'correctLength',
): number {
  let value = 0
  for (const point of trace) {
    if (point.timestamp > t) break
    value = point[field]
  }
  return value
}

function countCorrect(text: string, typed: string): number {
  let correct = 0
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === text[i]) correct++
  }
  return correct
}

/**
 * Instantaneous wpm over the course of a finished run, bucketed into 1s
 * windows. Mirrors useTypingEngine's replay semantics (continue-through-
 * errors, locked after finish) so this is consistent with the headline
 * wpm/rawWpm stats, not a separate calculation that can quietly disagree
 * with them. Returns [] for runs too short to tell a meaningful "over
 * time" story.
 */
export function computeWpmSeries(
  text: string,
  keystrokes: Keystroke[],
  startTimestamp?: number,
): WpmPoint[] {
  let typed = ''
  let firstTimestamp: number | null = null
  let finishTimestamp: number | null = null
  const trace: TracePoint[] = []

  for (const ks of keystrokes) {
    if (finishTimestamp !== null) break
    if (firstTimestamp === null) firstTimestamp = ks.timestamp

    if (ks.key === 'Backspace') {
      typed = typed.slice(0, -1)
    } else if (ks.key.length === 1 && typed.length < text.length) {
      typed += ks.key
    } else {
      continue
    }

    trace.push({
      timestamp: ks.timestamp,
      typedLength: typed.length,
      correctLength: countCorrect(text, typed),
    })

    if (typed.length === text.length) {
      finishTimestamp = ks.timestamp
    }
  }

  if (firstTimestamp === null || finishTimestamp === null) return []

  // A race measures elapsed time from the synchronized start, not this
  // player's own first keystroke - same reasoning as useTypingEngine's
  // startTimestamp option, so the chart's time axis never disagrees with
  // the headline wpm/duration stat it's illustrating.
  const origin = startTimestamp ?? firstTimestamp
  const durationMs = finishTimestamp - origin
  if (durationMs < MIN_DURATION_MS) return []

  const bucketCount = Math.ceil(durationMs / BUCKET_MS)
  const points: WpmPoint[] = []

  for (let b = 0; b < bucketCount; b++) {
    const bucketStart = origin + b * BUCKET_MS
    const bucketEnd = Math.min(origin + (b + 1) * BUCKET_MS, finishTimestamp)
    const actualBucketMs = bucketEnd - bucketStart
    if (actualBucketMs <= 0) continue

    const rawDelta = Math.max(
      0,
      valueAtOrBefore(trace, bucketEnd, 'typedLength') -
        valueAtOrBefore(trace, bucketStart, 'typedLength'),
    )
    const correctDelta = Math.max(
      0,
      valueAtOrBefore(trace, bucketEnd, 'correctLength') -
        valueAtOrBefore(trace, bucketStart, 'correctLength'),
    )
    const minutes = actualBucketMs / 60_000

    points.push({
      // Derived from the bucket index, not rounded from bucketEnd - a
      // short trailing bucket (the run didn't finish on a whole second)
      // would otherwise round down to the same second as the prior bucket,
      // producing two points at an identical timeSec.
      timeSec: b + 1,
      wpm: minutes > 0 ? correctDelta / WORD_LENGTH / minutes : 0,
      rawWpm: minutes > 0 ? rawDelta / WORD_LENGTH / minutes : 0,
    })
  }

  return points
}
