import { useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'theme-preference'

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // Private browsing / storage disabled: fall back silently.
  }
  return 'system'
}

function applyPreference(preference: ThemePreference) {
  if (preference === 'system') {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = preference
  }
}

interface UseThemeResult {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

export function useTheme(): UseThemeResult {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(readStoredPreference)

  useEffect(() => {
    applyPreference(preference)
  }, [preference])

  function setPreference(next: ThemePreference) {
    setPreferenceState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private browsing / storage disabled: the theme still applies for
      // this session via state, it just won't persist across reloads.
    }
  }

  return { preference, setPreference }
}
