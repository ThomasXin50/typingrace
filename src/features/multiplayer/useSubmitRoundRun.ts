import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Keystroke } from '../typing/useTypingEngine'

export type ValidationStatus = 'verified' | 'flagged' | 'rejected'

export interface RoundSubmitResult {
  status: ValidationStatus
  reason?: string
  placement: number | null
  fieldSize: number
}

interface UseSubmitRoundRunResult {
  submitting: boolean
  result: RoundSubmitResult | null
  error: string | null
  submit: (roundId: string, keystrokes: Keystroke[]) => void
}

export function useSubmitRoundRun(): UseSubmitRoundRunResult {
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<RoundSubmitResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function submit(roundId: string, keystrokes: Keystroke[]) {
    setSubmitting(true)
    setError(null)
    setResult(null)

    supabase.functions
      .invoke('submit-round-run', { body: { roundId, keystrokes } })
      .then(({ data, error: invokeError }) => {
        if (invokeError) {
          setError(invokeError.message)
        } else {
          setResult(data as RoundSubmitResult)
        }
        setSubmitting(false)
      })
  }

  return { submitting, result, error, submit }
}
