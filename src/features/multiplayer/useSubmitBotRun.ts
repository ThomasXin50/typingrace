import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface BotRunStats {
  wpm: number
  rawWpm: number
  accuracy: number
  errorCount: number
}

interface UseSubmitBotRunResult {
  submitting: boolean
  error: string | null
  submitBotRun: (roundId: string, botId: string, stats: BotRunStats) => void
}

// Fire-and-forget from the caller's perspective (a bot's own result never
// blocks anything the player is doing) - see submit-bot-run's own comment
// for why it's safe to report these numbers as-is rather than have the
// server re-validate them the way it does for a human's submission.
export function useSubmitBotRun(): UseSubmitBotRunResult {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function submitBotRun(roundId: string, botId: string, stats: BotRunStats) {
    setSubmitting(true)
    setError(null)

    supabase.functions
      .invoke('submit-bot-run', { body: { roundId, botId, ...stats } })
      .then(({ error: invokeError }) => {
        if (invokeError) setError(invokeError.message)
        setSubmitting(false)
      })
  }

  return { submitting, error, submitBotRun }
}
