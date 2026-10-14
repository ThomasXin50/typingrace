import { useLayoutEffect, useState } from 'react'
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

  // useLayoutEffect, not useEffect: a caller that first renders with a
  // placeholder startedAt (data not loaded yet) and then the real value
  // needs this resynced before the browser paints, not on whatever later
  // tick happens to fire next - otherwise the stale number (computed from
  // the placeholder, back when this hook's state was first initialized)
  // is what the user actually sees for that frame.
  useLayoutEffect(() => {
    // Intentional: useLayoutEffect runs synchronously before paint
    // specifically so this correction is never visible as its own frame,
    // unlike the cascading-extra-render concern react-hooks/set-state-in-effect
    // is otherwise right to flag for a plain useEffect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemaining(msRemaining(startedAt, Date.now()))

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
