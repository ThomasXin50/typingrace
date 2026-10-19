import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { BotPersonality } from './botPersonalities'

interface UseAddBotResult {
  adding: boolean
  error: string | null
  addBot: (
    roomId: string,
    personality?: BotPersonality,
    onAdded?: () => void,
  ) => void
}

export function useAddBot(): UseAddBotResult {
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addBot(
    roomId: string,
    personality?: BotPersonality,
    onAdded?: () => void,
  ) {
    setAdding(true)
    setError(null)

    supabase.functions
      .invoke('add-room-bot', {
        body: personality ? { roomId, personality } : { roomId },
      })
      .then(({ error: invokeError }) => {
        if (invokeError) {
          setError(invokeError.message)
        } else {
          onAdded?.()
        }
        setAdding(false)
      })
  }

  return { adding, error, addBot }
}
