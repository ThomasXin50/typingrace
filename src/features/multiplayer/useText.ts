import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface UseTextResult {
  content: string | null
  loading: boolean
  error: string | null
}

// A round only carries text_id - a joiner (unlike the host, who gets
// textContent back from start-race directly) learns about the round via
// Realtime, which never carries joined data, so it needs its own fetch.
export function useText(textId: string | null): UseTextResult {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(textId !== null)
  const [error, setError] = useState<string | null>(null)
  const [syncedFor, setSyncedFor] = useState(textId)

  if (textId !== syncedFor) {
    setLoading(textId !== null)
    setError(null)
    setSyncedFor(textId)
  }

  useEffect(() => {
    if (!textId) return

    let active = true

    supabase
      .from('texts')
      .select('content')
      .eq('id', textId)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (!active) return

        if (fetchError) {
          setError(fetchError.message)
        } else {
          setContent(data?.content ?? null)
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [textId])

  return { content, loading, error }
}
