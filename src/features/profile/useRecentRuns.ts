import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface RecentRun {
  id: string
  createdAt: string
  wpm: number
  rawWpm: number
  accuracy: number
  errorCount: number
  durationMs: number
  validationStatus: 'verified' | 'flagged' | 'rejected'
}

interface UseRecentRunsResult {
  runs: RecentRun[]
  loading: boolean
  error: string | null
}

const RECENT_RUNS_LIMIT = 20

// Every validation status is included (not just verified) - this is the
// one place a user can see why a run didn't count toward their stats,
// rather than it silently vanishing. The trend chart that reads from this
// same hook filters down to verified-only itself, since flagged/rejected
// wpm values aren't a trustworthy signal to chart.
export function useRecentRuns(): UseRecentRunsResult {
  const [runs, setRuns] = useState<RecentRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      // RLS already scopes solo_runs to the caller's own rows.
      const { data, error: fetchError } = await supabase
        .from('solo_runs')
        .select(
          'id, created_at, wpm, raw_wpm, accuracy, error_count, duration_ms, validation_status',
        )
        .order('created_at', { ascending: false })
        .limit(RECENT_RUNS_LIMIT)

      if (!active) return

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setRuns(
          (
            (data ?? []) as Array<{
              id: string
              created_at: string
              wpm: number
              raw_wpm: number
              accuracy: number
              error_count: number
              duration_ms: number
              validation_status: RecentRun['validationStatus']
            }>
          ).map((r) => ({
            id: r.id,
            createdAt: r.created_at,
            wpm: r.wpm,
            rawWpm: r.raw_wpm,
            accuracy: r.accuracy,
            errorCount: r.error_count,
            durationMs: r.duration_ms,
            validationStatus: r.validation_status,
          })),
        )
      }
      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [])

  return { runs, loading, error }
}
