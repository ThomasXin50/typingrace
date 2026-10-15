import { useCallback, useEffect, useRef } from 'react'

const STALL_TIMEOUT_MS = 10_000

interface UseStallWatcherOptions {
  active: boolean
  onStall: () => void
}

// An idle timer: the returned ping() resets it, and onStall fires once
// STALL_TIMEOUT_MS elapses without a ping. Runs only while `active` - armed
// the instant a race begins (not waiting for a first keystroke that might
// never come), and disarmed the moment this player has genuinely finished
// or the round has already closed.
export function useStallWatcher({
  active,
  onStall,
}: UseStallWatcherOptions): () => void {
  const onStallRef = useRef(onStall)
  useEffect(() => {
    onStallRef.current = onStall
  }, [onStall])

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ping = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onStallRef.current(), STALL_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    if (!active) return

    ping()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [active, ping])

  return ping
}
