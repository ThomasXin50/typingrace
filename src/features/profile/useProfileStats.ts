import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface ProfileStats {
  totalRuns: number
  bestWpm: number
  avgWpm: number
  avgAccuracy: number
}

interface UseProfileStatsResult {
  stats: ProfileStats | null
  loading: boolean
  error: string | null
}

export function useProfileStats(): UseProfileStatsResult {
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      // RLS already scopes solo_runs to the caller's own rows.
      const { data, error: fetchError } = await supabase
        .from('solo_runs')
        .select('wpm, accuracy')
        .eq('validation_status', 'verified')

      if (!active) return

      if (fetchError) {
        setError(fetchError.message)
      } else if (data && data.length > 0) {
        const wpms = data.map((r) => r.wpm as number)
        const accuracies = data.map((r) => r.accuracy as number)
        setStats({
          totalRuns: wpms.length,
          bestWpm: Math.max(...wpms),
          avgWpm: wpms.reduce((a, b) => a + b, 0) / wpms.length,
          avgAccuracy:
            accuracies.reduce((a, b) => a + b, 0) / accuracies.length,
        })
      }
      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [])

  return { stats, loading, error }
}
