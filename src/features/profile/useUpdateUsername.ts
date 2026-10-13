import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface UseUpdateUsernameResult {
  submitting: boolean
  success: boolean
  error: string | null
  update: (userId: string, username: string) => void
}

export function useUpdateUsername(): UseUpdateUsernameResult {
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(userId: string, username: string) {
    setSubmitting(true)
    setSuccess(false)
    setError(null)

    supabase
      .from('profiles')
      .update({ username })
      .eq('id', userId)
      .then(({ error: updateError }) => {
        if (updateError) {
          setError(updateError.message)
        } else {
          setSuccess(true)
        }
        setSubmitting(false)
      })
  }

  return { submitting, success, error, update }
}
