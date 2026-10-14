import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface RoundResult {
  user_id: string
  status: 'racing' | 'finished' | 'stalled'
  validation_status: 'verified' | 'flagged' | 'rejected' | null
  wpm: number | null
  placement: number | null
  field_size: number | null
  username: string
  is_anonymous: boolean
}

interface UseRoundResultsResult {
  results: RoundResult[]
  loading: boolean
  error: string | null
}

function byPlacement(a: RoundResult, b: RoundResult): number {
  if (a.placement === null && b.placement === null) return 0
  if (a.placement === null) return 1
  if (b.placement === null) return -1
  return a.placement - b.placement
}

// Same refetch-on-change shape as useRoom/useActiveRound: a change event is
// a cue to refetch, not something to merge from its payload (which never
// carries the joined profile data this needs for display names anyway).
// Doubles as both a live "who's finished so far" board during the race and
// the final results once everyone's done. roundId is nullable the same way
// useText's textId is - a caller (RacePage) must call this unconditionally
// before its own round data has necessarily loaded.
export function useRoundResults(roundId: string | null): UseRoundResultsResult {
  const [results, setResults] = useState<RoundResult[]>([])
  const [loading, setLoading] = useState(roundId !== null)
  const [error, setError] = useState<string | null>(null)
  const [syncedFor, setSyncedFor] = useState(roundId)

  if (roundId !== syncedFor) {
    setLoading(roundId !== null)
    setError(null)
    setSyncedFor(roundId)
  }

  useEffect(() => {
    if (!roundId) return

    let active = true

    async function load() {
      const { data, error: fetchError } = await supabase
        .from('round_participants')
        .select(
          'user_id, status, validation_status, wpm, placement, field_size, profiles(username, is_anonymous)',
        )
        .eq('round_id', roundId)

      if (!active) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      const rows = (
        (data ?? []) as unknown as Array<{
          user_id: string
          status: 'racing' | 'finished' | 'stalled'
          validation_status: 'verified' | 'flagged' | 'rejected' | null
          wpm: number | null
          placement: number | null
          field_size: number | null
          profiles: { username: string; is_anonymous: boolean }
        }>
      ).map((r) => ({
        user_id: r.user_id,
        status: r.status,
        validation_status: r.validation_status,
        wpm: r.wpm,
        placement: r.placement,
        field_size: r.field_size,
        username: r.profiles.username,
        is_anonymous: r.profiles.is_anonymous,
      }))

      setResults(rows.sort(byPlacement))
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`results:${roundId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_participants',
          filter: `round_id=eq.${roundId}`,
        },
        load,
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [roundId])

  return { results, loading, error }
}
