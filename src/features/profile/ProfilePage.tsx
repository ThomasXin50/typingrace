import { useState } from 'react'
import { useTheme, type ThemePreference } from '../../app/useTheme'
import { useProfile } from '../auth/useProfile'
import { useProfileStats } from './useProfileStats'
import { useUpdateUsername } from './useUpdateUsername'
import './profile.css'

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ProfilePage() {
  const { profile, loading, error } = useProfile()
  const { stats, loading: statsLoading, error: statsError } = useProfileStats()
  const { preference, setPreference } = useTheme()
  const updateUsername = useUpdateUsername()
  const [usernameInput, setUsernameInput] = useState('')
  const [initializedFor, setInitializedFor] = useState<string | null>(null)

  // Adjust state during render (React's documented pattern for seeding
  // local editable state from an async value once, without an effect that
  // would re-sync on every profile re-render and clobber in-progress edits).
  if (profile && initializedFor !== profile.id) {
    setUsernameInput(profile.username)
    setInitializedFor(profile.id)
  }

  if (loading) {
    return <p className="page-status">Loading...</p>
  }

  if (error) {
    return (
      <p className="page-status" role="alert">
        {error}
      </p>
    )
  }

  function handleSave() {
    if (profile) updateUsername.update(profile.id, usernameInput)
  }

  return (
    <div className="profile-page">
      <section>
        <h2>Profile</h2>

        {statsLoading && <p className="page-status">Loading stats…</p>}
        {statsError && (
          <p className="page-status" role="alert">
            {statsError}
          </p>
        )}
        {!statsLoading && !statsError && !stats && (
          <p className="stat-row-empty">No runs yet.</p>
        )}
        {stats && (
          <div className="stat-row panel-enter">
            <div className="stat-tile stat-tile--primary">
              <span className="stat-tile__value">
                {Math.round(stats.bestWpm)}
              </span>
              <span className="stat-tile__label">best wpm</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__value">
                {Math.round(stats.avgWpm)}
              </span>
              <span className="stat-tile__label">avg wpm</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__value">
                {Math.round(stats.avgAccuracy)}%
              </span>
              <span className="stat-tile__label">avg accuracy</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__value">{stats.totalRuns}</span>
              <span className="stat-tile__label">runs</span>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2>Settings</h2>

        <div className="profile-field">
          <label htmlFor="profile-username">Username</label>
          <div className="profile-field__row">
            <input
              id="profile-username"
              className="profile-field__input"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
            />
            <button
              type="button"
              className="btn"
              disabled={
                updateUsername.submitting || usernameInput.trim().length === 0
              }
              onClick={handleSave}
            >
              Save
            </button>
          </div>
          {updateUsername.success && (
            <p className="profile-field__status">Saved.</p>
          )}
          {updateUsername.error && (
            <p className="profile-field__status" role="alert">
              {updateUsername.error}
            </p>
          )}
          {profile?.isAnonymous && (
            <p className="profile-field__status">
              You're using a guest session — your stats are tied to this browser
              only.
            </p>
          )}
        </div>

        <fieldset className="profile-field">
          <legend>Theme</legend>
          <div className="profile-theme-options">
            {THEME_OPTIONS.map((option) => (
              <label key={option.value} className="profile-theme-option">
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={preference === option.value}
                  onChange={() => setPreference(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>
    </div>
  )
}
