import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface Profile {
  id: string
  username: string
}

interface UseProfileResult {
  profile: Profile | null
  loading: boolean
  error: string | null
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function bootstrap() {
      const { data: sessionData } = await supabase.auth.getSession()
      let userId = sessionData.session?.user.id

      if (!userId) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInAnonymously()

        if (signInError) {
          if (active) {
            setError(signInError.message)
            setLoading(false)
          }
          return
        }

        userId = signInData.user?.id
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('id', userId)
        .single()

      if (!active) return

      if (profileError) {
        setError(profileError.message)
      } else {
        setProfile(profileData as Profile)
      }
      setLoading(false)
    }

    bootstrap()

    return () => {
      active = false
    }
  }, [])

  return { profile, loading, error }
}
