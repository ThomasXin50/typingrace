import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { BotPersonality } from './botPersonalities'

export interface RoundBotResult {
  bot_id: string
  personality: BotPersonality
  wpm: number
  placement: number | null
  field_size: number
}

interface UseRoundBotResultsResult {
  results: RoundBotResult[]
  loading: boolean
  error: string | null
}

function byPlacement(a: RoundBotResult, b: RoundBotResult): number {
  if (a.placement === null && b.placement === null) return 0
  if (a.placement === null) return 1
  if (b.placement === null) return -1
  return a.placement - b.placement
}

// Same refetch-on-change shape as useRoundResults - the bot-side
// counterpart, kept as its own table/hook since bots have no profiles row
// to join (see supabase/CLAUDE.md). roundId is nullable for the same
// reason useRoundResults' is: RacePage calls this before its own round
// data has necessarily loaded.
export function useRoundBotResults(
  roundId: string | null,
): UseRoundBotResultsResult {
  const [results, setResults] = useState<RoundBotResult[]>([])
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
        .from('round_bot_results')
        .select('bot_id, personality, wpm, placement, field_size')
        .eq('round_id', roundId)

      if (!active) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      setResults(((data ?? []) as RoundBotResult[]).sort(byPlacement))
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`bot-results:${roundId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_bot_results',
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
