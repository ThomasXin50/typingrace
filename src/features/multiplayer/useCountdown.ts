import { useEffect, useState } from 'react'
import { msRemaining } from './countdownMath'

interface UseCountdownResult {
  msRemaining: number
  hasStarted: boolean
}

const TICK_MS = 200

export function useCountdown(startedAt: string): UseCountdownResult {
  const [remaining, setRemaining] = useState(() =>
    msRemaining(startedAt, Date.now()),
  )

  useEffect(() => {
    if (msRemaining(startedAt, Date.now()) <= 0) return

    const interval = setInterval(() => {
      const next = msRemaining(startedAt, Date.now())
      setRemaining(next)
      if (next <= 0) clearInterval(interval)
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [startedAt])

  return { msRemaining: remaining, hasStarted: remaining <= 0 }
}
