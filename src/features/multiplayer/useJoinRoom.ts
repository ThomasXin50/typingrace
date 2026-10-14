import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { RoomSummary } from './types'

interface UseJoinRoomResult {
  joining: boolean
  room: RoomSummary | null
  error: string | null
  joinRoom: (joinCode: string) => void
}

export function useJoinRoom(): UseJoinRoomResult {
  const [joining, setJoining] = useState(false)
  const [room, setRoom] = useState<RoomSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  function joinRoom(joinCode: string) {
    setJoining(true)
    setError(null)
    setRoom(null)

    supabase.functions
      .invoke('join-room', { body: { joinCode } })
      .then(({ data, error: invokeError }) => {
        if (invokeError) {
          setError(invokeError.message)
        } else {
          setRoom(data as RoomSummary)
        }
        setJoining(false)
      })
  }

  return { joining, room, error, joinRoom }
}
