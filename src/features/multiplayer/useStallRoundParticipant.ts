import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface UseStallRoundParticipantResult {
  stalling: boolean
  error: string | null
  stall: (roundId: string) => void
}

// Mirrors useSubmitRoundRun's shape, minus a result payload - there's
// nothing to report back once stalled (no wpm/placement), so callers fire
// this and move on rather than waiting on a response.
export function useStallRoundParticipant(): UseStallRoundParticipantResult {
  const [stalling, setStalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function stall(roundId: string) {
    setStalling(true)
    setError(null)

    supabase.functions
      .invoke('stall-round-participant', { body: { roundId } })
      .then(({ error: invokeError }) => {
        if (invokeError) {
          setError(invokeError.message)
        }
        setStalling(false)
      })
  }

  return { stalling, error, stall }
}
