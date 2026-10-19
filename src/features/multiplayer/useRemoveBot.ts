import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface UseRemoveBotResult {
  removing: boolean
  error: string | null
  removeBot: (roomId: string, botId: string, onRemoved?: () => void) => void
}

export function useRemoveBot(): UseRemoveBotResult {
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function removeBot(roomId: string, botId: string, onRemoved?: () => void) {
    setRemoving(true)
    setError(null)

    supabase.functions
      .invoke('remove-room-bot', { body: { roomId, botId } })
      .then(({ error: invokeError }) => {
        if (invokeError) {
          setError(invokeError.message)
        } else {
          onRemoved?.()
        }
        setRemoving(false)
      })
  }

  return { removing, error, removeBot }
}
