import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface HomeStats {
  totalRuns: number
  bestWpm: number
  avgWpm: number
}

interface UseHomeStatsResult {
  stats: HomeStats | null
  loading: boolean
  error: string | null
}

export function useHomeStats(): UseHomeStatsResult {
  const [stats, setStats] = useState<HomeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      // RLS already scopes solo_runs to the caller's own rows.
      const { data, error: fetchError } = await supabase
        .from('solo_runs')
        .select('wpm')
        .eq('validation_status', 'verified')

      if (!active) return

      if (fetchError) {
        setError(fetchError.message)
      } else if (data && data.length > 0) {
        const wpms = data.map((r) => r.wpm as number)
        setStats({
          totalRuns: wpms.length,
          bestWpm: Math.max(...wpms),
          avgWpm: wpms.reduce((a, b) => a + b, 0) / wpms.length,
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
