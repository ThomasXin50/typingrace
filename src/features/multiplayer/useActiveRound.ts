import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface RoundRow {
  id: string
  room_id: string
  text_id: string
  status: 'active' | 'finished'
  started_at: string
  calibration_wpm: number | null
}

interface UseActiveRoundResult {
  round: RoundRow | null
  loading: boolean
  error: string | null
}

// Same refetch-on-change shape as useRoom: a postgres_changes event here is
// a cue to refetch, not something to merge from its payload.
export function useActiveRound(roomId: string): UseActiveRoundResult {
  const [round, setRound] = useState<RoundRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      const { data, error: fetchError } = await supabase
        .from('rounds')
        .select('*')
        .eq('room_id', roomId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!active) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      setRound(data as RoundRow | null)
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`round:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rounds',
          filter: `room_id=eq.${roomId}`,
        },
        load,
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [roomId])

  return { round, loading, error }
}
