import { useEffect, useState } from 'react'

const TICK_MS = 40

/**
 * Animates a displayed number from 0 up to `target` over `durationMs` -
 * the one "reward beat" a finished run gets, so the final stats feel
 * earned rather than just materializing. Ticks on a plain interval (same
 * convention as useCountdown) rather than requestAnimationFrame, both for
 * consistency with the rest of this codebase and because it's trivially
 * fake-timer-testable.
 */
export function useCountUp(target: number, durationMs: number): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    // Synchronous, mirroring useCountdown's own resync pattern: without
    // it, the first paint after `target` changes under reduced motion
    // would flash a bare 0 for a frame before correcting.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(target)
      return
    }

    const start = Date.now()
    setValue(0)

    let timeoutId: ReturnType<typeof setTimeout>

    function tick() {
      const elapsed = Date.now() - start
      const progress = Math.min(1, elapsed / durationMs)
      setValue(target * progress)
      // Clamp the final tick to land exactly on durationMs, rather than
      // whatever multiple of TICK_MS happens to fall closest to it - a
      // fixed-cadence interval would otherwise settle on a value just
      // short of target instead of hitting it exactly.
      if (progress < 1) {
        timeoutId = setTimeout(tick, Math.min(TICK_MS, durationMs - elapsed))
      }
    }

    timeoutId = setTimeout(tick, TICK_MS)

    return () => clearTimeout(timeoutId)
  }, [target, durationMs])

  return value
}
