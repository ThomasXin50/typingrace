import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface StartRaceResult {
  roundId: string
  textContent: string
  startedAt: string
}

interface UseStartRaceResult {
  starting: boolean
  round: StartRaceResult | null
  error: string | null
  startRace: (roomId: string) => void
}

export function useStartRace(): UseStartRaceResult {
  const [starting, setStarting] = useState(false)
  const [round, setRound] = useState<StartRaceResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function startRace(roomId: string) {
    setStarting(true)
    setError(null)
    setRound(null)

    supabase.functions
      .invoke('start-race', { body: { roomId } })
      .then(({ data, error: invokeError }) => {
        if (invokeError) {
          setError(invokeError.message)
        } else {
          setRound(data as StartRaceResult)
        }
        setStarting(false)
      })
  }

  return { starting, round, error, startRace }
}
