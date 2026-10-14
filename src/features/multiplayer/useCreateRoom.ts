import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { RoomSummary } from './types'

interface UseCreateRoomResult {
  creating: boolean
  room: RoomSummary | null
  error: string | null
  createRoom: (options?: {
    maxPlayers?: number
    difficultyFilter?: RoomSummary['difficultyFilter']
  }) => void
}

export function useCreateRoom(): UseCreateRoomResult {
  const [creating, setCreating] = useState(false)
  const [room, setRoom] = useState<RoomSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  function createRoom(options?: {
    maxPlayers?: number
    difficultyFilter?: RoomSummary['difficultyFilter']
  }) {
    setCreating(true)
    setError(null)
    setRoom(null)

    supabase.functions
      .invoke('create-room', { body: options ?? {} })
      .then(({ data, error: invokeError }) => {
        if (invokeError) {
          setError(invokeError.message)
        } else {
          setRoom(data as RoomSummary)
        }
        setCreating(false)
      })
  }

  return { creating, room, error, createRoom }
}
