import { useState } from 'react'

export type CharStatus = 'correct' | 'incorrect' | 'current' | 'pending'
export type TypingStatus = 'idle' | 'running' | 'finished'

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
}

interface UseTypingEngineResult {
  typed: string
  charStatuses: CharStatus[]
  status: TypingStatus
  stats: TypingStats | null
  keystrokes: Keystroke[]
  handleKeyDown: (event: Keystroke) => void
  reset: () => void
}

const WORD_LENGTH = 5

function computeCharStatuses(text: string, typed: string): CharStatus[] {
  return text.split('').map((char, i) => {
    if (i < typed.length) return typed[i] === char ? 'correct' : 'incorrect'
    if (i === typed.length) return 'current'
    return 'pending'
  })
}

/**
 * Replays the keystroke log against the text. Mirrors the Edge Function's
 * computeStats() exactly (same continue-through-errors model, same
 * finish-lock behavior) so the live preview and the server-authoritative
 * validation can never silently disagree.
 */
function replay(text: string, keystrokes: Keystroke[]) {
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
    if (typed.length >= text.length) continue

    totalKeystrokes += 1
    if (ks.key !== text[typed.length]) mistakeCount += 1
    typed += ks.key

    if (typed.length === text.length) {
      finishTimestamp = ks.timestamp
    }
  }

  const finished = finishTimestamp !== null
  const durationMs =
    finished && firstTimestamp !== null ? finishTimestamp! - firstTimestamp : 0

  return { typed, totalKeystrokes, mistakeCount, finished, durationMs }
}

export function useTypingEngine(text: string): UseTypingEngineResult {
  const [keystrokes, setKeystrokes] = useState<Keystroke[]>([])

  const { typed, totalKeystrokes, mistakeCount, finished, durationMs } = replay(
    text,
    keystrokes,
  )

  const status: TypingStatus = finished
    ? 'finished'
    : keystrokes.length > 0
      ? 'running'
      : 'idle'

  let stats: TypingStats | null = null
  if (finished) {
    const minutes = durationMs / 60_000
    let correctChars = 0
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === text[i]) correctChars += 1
    }

    stats = {
      wpm: minutes > 0 ? correctChars / WORD_LENGTH / minutes : 0,
      rawWpm: minutes > 0 ? totalKeystrokes / WORD_LENGTH / minutes : 0,
      accuracy:
        totalKeystrokes > 0
          ? ((totalKeystrokes - mistakeCount) / totalKeystrokes) * 100
          : 100,
      durationMs,
      errorCount: mistakeCount,
    }
  }

  function handleKeyDown(event: Keystroke) {
    if (finished) return
    setKeystrokes((prev) => [...prev, event])
  }

  function reset() {
    setKeystrokes([])
  }

  return {
    typed,
    charStatuses: computeCharStatuses(text, typed),
    status,
    stats,
    keystrokes,
    handleKeyDown,
    reset,
  }
}
