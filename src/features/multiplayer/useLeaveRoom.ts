import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface UseLeaveRoomResult {
  leaving: boolean
  error: string | null
  leaveRoom: (roomId: string, onLeft?: () => void) => void
}

export function useLeaveRoom(): UseLeaveRoomResult {
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function leaveRoom(roomId: string, onLeft?: () => void) {
    setLeaving(true)
    setError(null)

    supabase.functions
      .invoke('leave-room', { body: { roomId } })
      .then(({ error: invokeError }) => {
        if (invokeError) {
          setError(invokeError.message)
        } else {
          onLeft?.()
        }
        setLeaving(false)
      })
  }

  return { leaving, error, leaveRoom }
}
