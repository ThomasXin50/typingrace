import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface LeaderboardEntry {
  user_id: string
  username: string
  runs: number
  avg_wpm: number
  best_wpm: number
  rank: number
}

interface UseLeaderboardResult {
  entries: LeaderboardEntry[]
  loading: boolean
  error: string | null
}

export function useLeaderboard(): UseLeaderboardResult {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      const { data, error: fetchError } = await supabase
        .from('leaderboard_global')
        .select('*')
        .order('rank', { ascending: true })

      if (!active) return

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setEntries((data as LeaderboardEntry[]) ?? [])
      }
      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [])

  return { entries, loading, error }
}
