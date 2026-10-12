import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface TypingText {
  id: string
  content: string
}

interface UseRandomTextResult {
  text: TypingText | null
  loading: boolean
  error: string | null
  requestNext: () => void
}

function pickRandom(texts: TypingText[], excludeId?: string): TypingText {
  const choices =
    texts.length > 1 ? texts.filter((t) => t.id !== excludeId) : texts
  return choices[Math.floor(Math.random() * choices.length)]
}

export function useRandomText(): UseRandomTextResult {
  const [texts, setTexts] = useState<TypingText[] | null>(null)
  const [text, setText] = useState<TypingText | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      const { data, error: fetchError } = await supabase
        .from('texts')
        .select('id, content')
        .eq('status', 'approved')

      if (!active) return

      if (fetchError) {
        setError(fetchError.message)
      } else if (!data || data.length === 0) {
        setError('No approved texts are available')
      } else {
        setTexts(data)
        setText(pickRandom(data))
      }
      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [])

  function requestNext() {
    if (!texts || texts.length === 0) return
    setText(pickRandom(texts, text?.id))
  }

  return { text, loading, error, requestNext }
}
