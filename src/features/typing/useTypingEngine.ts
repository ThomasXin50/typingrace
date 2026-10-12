import { useRef, useState } from 'react'

export type CharStatus = 'correct' | 'incorrect' | 'current' | 'pending'
export type TypingStatus = 'idle' | 'running' | 'finished'

export interface TypingStats {
  wpm: number
  rawWpm: number
  accuracy: number
  durationMs: number
  errorCount: number
}

export interface UseTypingEngineResult {
  typed: string
  charStatuses: CharStatus[]
  status: TypingStatus
  stats: TypingStats | null
  handleChange: (value: string) => void
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

export function useTypingEngine(text: string): UseTypingEngineResult {
  const [typed, setTyped] = useState('')
  const [status, setStatus] = useState<TypingStatus>('idle')
  const [stats, setStats] = useState<TypingStats | null>(null)

  const startTimeRef = useRef<number | null>(null)
  const totalKeystrokesRef = useRef(0)
  const mistakeCountRef = useRef(0)

  function handleChange(value: string) {
    if (status === 'finished') return

    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now()
    }

    if (value.length > typed.length) {
      for (let i = typed.length; i < value.length; i++) {
        totalKeystrokesRef.current += 1
        if (value[i] !== text[i]) mistakeCountRef.current += 1
      }
    }

    const clamped = value.slice(0, text.length)
    setTyped(clamped)
    setStatus('running')

    if (clamped.length === text.length) {
      const durationMs = Date.now() - (startTimeRef.current ?? Date.now())
      const minutes = durationMs / 60_000
      const correctChars = computeCharStatuses(text, clamped).filter(
        (s) => s === 'correct',
      ).length

      setStats({
        wpm: minutes > 0 ? correctChars / WORD_LENGTH / minutes : 0,
        rawWpm:
          minutes > 0 ? totalKeystrokesRef.current / WORD_LENGTH / minutes : 0,
        accuracy:
          totalKeystrokesRef.current > 0
            ? ((totalKeystrokesRef.current - mistakeCountRef.current) /
                totalKeystrokesRef.current) *
              100
            : 100,
        durationMs,
        errorCount: mistakeCountRef.current,
      })
      setStatus('finished')
    }
  }

  function reset() {
    setTyped('')
    setStatus('idle')
    setStats(null)
    startTimeRef.current = null
    totalKeystrokesRef.current = 0
    mistakeCountRef.current = 0
  }

  return {
    typed,
    charStatuses: computeCharStatuses(text, typed),
    status,
    stats,
    handleChange,
    reset,
  }
}
