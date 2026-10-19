import { useState } from 'react'
import { useTheme, type ThemePreference } from '../../app/useTheme'
import { formatElapsed } from '../../lib/formatElapsed'
import { useProfile } from '../auth/useProfile'
import { RunsTrendChart } from './RunsTrendChart'
import { useProfileStats } from './useProfileStats'
import { useRecentRuns } from './useRecentRuns'
import { useUpdateUsername } from './useUpdateUsername'
import './profile.css'

function formatRunDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ProfilePage() {
  const { profile, loading, error } = useProfile()
  const { stats, loading: statsLoading, error: statsError } = useProfileStats()
  const {
    runs: recentRuns,
    loading: recentRunsLoading,
    error: recentRunsError,
  } = useRecentRuns()
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
        <h2>Recent runs</h2>

        {recentRunsLoading && <p className="page-status">Loading runs…</p>}
        {recentRunsError && (
          <p className="page-status" role="alert">
            {recentRunsError}
          </p>
        )}
        {!recentRunsLoading && !recentRunsError && recentRuns.length === 0 && (
          <p className="stat-row-empty">
            No runs yet — head to Solo to start building your history.
          </p>
        )}
        {recentRuns.length > 0 && (
          <>
            <RunsTrendChart runs={recentRuns} />
            <table className="profile-runs-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Wpm</th>
                  <th scope="col">Accuracy</th>
                  <th scope="col">Errors</th>
                  <th scope="col">Duration</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{formatRunDate(run.createdAt)}</td>
                    <td>
                      {Math.round(run.wpm)}
                      {run.validationStatus !== 'verified' && (
                        <span className="profile-runs-table__status">
                          {run.validationStatus}
                        </span>
                      )}
                    </td>
                    <td>{Math.round(run.accuracy)}%</td>
                    <td>{run.errorCount}</td>
                    <td>{formatElapsed(run.durationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
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
            <p className="profile-field__status profile-field__status--success panel-enter">
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M3 8.5l3 3 7-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Saved.
            </p>
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
