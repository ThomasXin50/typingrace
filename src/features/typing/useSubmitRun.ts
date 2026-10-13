import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Keystroke } from './useTypingEngine'

export type ValidationStatus = 'verified' | 'flagged' | 'rejected'

export interface SubmitResult {
  status: ValidationStatus
  reason?: string
}

interface UseSubmitRunResult {
  submitting: boolean
  result: SubmitResult | null
  error: string | null
  submit: (textId: string, keystrokes: Keystroke[]) => void
}

export function useSubmitRun(): UseSubmitRunResult {
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function submit(textId: string, keystrokes: Keystroke[]) {
    setSubmitting(true)
    setError(null)
    setResult(null)

    supabase.functions
      .invoke('submit-solo-run', { body: { textId, keystrokes } })
      .then(({ data, error: invokeError }) => {
        if (invokeError) {
          setError(invokeError.message)
        } else {
          setResult(data as SubmitResult)
        }
        setSubmitting(false)
      })
  }

  return { submitting, result, error, submit }
}
