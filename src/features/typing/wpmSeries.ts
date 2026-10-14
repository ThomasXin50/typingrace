import type { Keystroke } from './useTypingEngine'

export interface WpmPoint {
  timeSec: number
  wpm: number
}

const BUCKET_MS = 1000
const MIN_DURATION_MS = BUCKET_MS * 3
const WORD_LENGTH = 5

interface TracePoint {
  timestamp: number
  typedLength: number
}

function lengthAtOrBefore(trace: TracePoint[], t: number): number {
  let length = 0
  for (const point of trace) {
    if (point.timestamp > t) break
    length = point.typedLength
  }
  return length
}

/**
 * Instantaneous wpm over the course of a finished run, bucketed into 1s
 * windows. Mirrors useTypingEngine's replay semantics (continue-through-
 * errors, locked after finish) so this is consistent with the headline
 * wpm stat, not a separate calculation that can quietly disagree with it.
 * Returns [] for runs too short to tell a meaningful "over time" story.
 */
export function computeWpmSeries(
  text: string,
  keystrokes: Keystroke[],
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

    trace.push({ timestamp: ks.timestamp, typedLength: typed.length })

    if (typed.length === text.length) {
      finishTimestamp = ks.timestamp
    }
  }

  if (firstTimestamp === null || finishTimestamp === null) return []

  const durationMs = finishTimestamp - firstTimestamp
  if (durationMs < MIN_DURATION_MS) return []

  const bucketCount = Math.ceil(durationMs / BUCKET_MS)
  const points: WpmPoint[] = []

  for (let b = 0; b < bucketCount; b++) {
    const bucketStart = firstTimestamp + b * BUCKET_MS
    const bucketEnd = Math.min(
      firstTimestamp + (b + 1) * BUCKET_MS,
      finishTimestamp,
    )
    const actualBucketMs = bucketEnd - bucketStart
    if (actualBucketMs <= 0) continue

    const lengthStart = lengthAtOrBefore(trace, bucketStart)
    const lengthEnd = lengthAtOrBefore(trace, bucketEnd)
    const delta = Math.max(0, lengthEnd - lengthStart)
    const minutes = actualBucketMs / 60_000

    points.push({
      // Derived from the bucket index, not rounded from bucketEnd - a
      // short trailing bucket (the run didn't finish on a whole second)
      // would otherwise round down to the same second as the prior bucket,
      // producing two points at an identical timeSec.
      timeSec: b + 1,
      wpm: minutes > 0 ? delta / WORD_LENGTH / minutes : 0,
    })
  }

  return points
}
