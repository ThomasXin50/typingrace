import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface RoomRow {
  id: string
  host_id: string
  status: 'lobby' | 'racing'
  max_players: number
  difficulty_filter: 'easy' | 'normal' | 'hard' | 'all'
  join_code: string
}

export interface RoomMember {
  user_id: string
  status: 'active' | 'spectating'
  joined_at: string
  username: string
  is_anonymous: boolean
}

interface UseRoomResult {
  room: RoomRow | null
  members: RoomMember[]
  loading: boolean
  error: string | null
}

// Realtime's postgres_changes payload carries only the changed table's own
// columns, never a joined relation - so a change event here is treated as
// "something changed, refetch", not something to merge piecemeal into
// state. The roster is small (max 10), so a full refetch per event is
// cheap and much simpler than reconstructing joined rows from partial
// payloads.
export function useRoom(roomId: string): UseRoomResult {
  const [room, setRoom] = useState<RoomRow | null>(null)
  const [members, setMembers] = useState<RoomMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      const [roomResult, membersResult] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
        supabase
          .from('room_members')
          .select(
            'user_id, status, joined_at, profiles(username, is_anonymous)',
          )
          .eq('room_id', roomId),
      ])

      if (!active) return

      const fetchError = roomResult.error ?? membersResult.error
      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      setRoom(roomResult.data as RoomRow | null)
      setMembers(
        (
          (membersResult.data ?? []) as unknown as Array<{
            user_id: string
            status: 'active' | 'spectating'
            joined_at: string
            profiles: { username: string; is_anonymous: boolean }
          }>
        ).map((m) => ({
          user_id: m.user_id,
          status: m.status,
          joined_at: m.joined_at,
          username: m.profiles.username,
          is_anonymous: m.profiles.is_anonymous,
        })),
      )
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${roomId}`,
        },
        load,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        load,
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [roomId])

  return { room, members, loading, error }
}
