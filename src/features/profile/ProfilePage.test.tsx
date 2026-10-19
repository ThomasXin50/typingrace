import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'

const mocks = vi.hoisted(() => ({
  useProfile: vi.fn(),
  useProfileStats: vi.fn(),
  useRecentRuns: vi.fn(),
  useTheme: vi.fn(),
  setPreference: vi.fn(),
  update: vi.fn(),
  useUpdateUsername: vi.fn(),
}))

vi.mock('../auth/useProfile', () => ({ useProfile: mocks.useProfile }))
vi.mock('./useProfileStats', () => ({ useProfileStats: mocks.useProfileStats }))
vi.mock('./useRecentRuns', () => ({ useRecentRuns: mocks.useRecentRuns }))
vi.mock('../../app/useTheme', () => ({ useTheme: mocks.useTheme }))
vi.mock('./useUpdateUsername', () => ({
  useUpdateUsername: mocks.useUpdateUsername,
}))

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useProfile.mockReturnValue({
      profile: { id: 'user-1', username: 'alice', isAnonymous: false },
      loading: false,
      error: null,
    })
    mocks.useProfileStats.mockReturnValue({
      stats: null,
      loading: false,
      error: null,
    })
    mocks.useRecentRuns.mockReturnValue({
      runs: [],
      loading: false,
      error: null,
    })
    mocks.useTheme.mockReturnValue({
      preference: 'system',
      setPreference: mocks.setPreference,
    })
    mocks.useUpdateUsername.mockReturnValue({
      submitting: false,
      success: false,
      error: null,
      update: mocks.update,
    })
  })

  it('shows a loading state while the profile resolves', () => {
    mocks.useProfile.mockReturnValue({
      profile: null,
      loading: true,
      error: null,
    })

    render(<ProfilePage />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders Profile, Recent runs, and Settings sections in order', () => {
    render(<ProfilePage />)

    const headings = screen.getAllByRole('heading').map((h) => h.textContent)
    expect(headings).toEqual(['Profile', 'Recent runs', 'Settings'])
  })

  it('shows an empty state for the aggregate stats when there are no runs yet', () => {
    render(<ProfilePage />)

    expect(screen.getByText('No runs yet.')).toBeInTheDocument()
  })

  it('shows an empty state for recent runs when there are none yet', () => {
    render(<ProfilePage />)

    expect(screen.getByText(/no runs yet.*head to solo/i)).toBeInTheDocument()
  })

  it('shows a loading state for recent runs while they resolve', () => {
    mocks.useRecentRuns.mockReturnValue({
      runs: [],
      loading: true,
      error: null,
    })

    render(<ProfilePage />)

    expect(screen.getByText(/loading runs/i)).toBeInTheDocument()
  })

  it('surfaces an error when recent runs fail to load', () => {
    mocks.useRecentRuns.mockReturnValue({
      runs: [],
      loading: false,
      error: 'boom',
    })

    render(<ProfilePage />)

    expect(screen.getByRole('alert')).toHaveTextContent('boom')
  })

  it('lists recent runs with their date, wpm, accuracy, errors, and duration, flagging non-verified ones', () => {
    mocks.useRecentRuns.mockReturnValue({
      runs: [
        {
          id: 'run-2',
          createdAt: '2026-01-02T12:00:00.000Z',
          wpm: 90,
          rawWpm: 95,
          accuracy: 96,
          errorCount: 2,
          durationMs: 12_000,
          validationStatus: 'verified',
        },
        {
          id: 'run-1',
          createdAt: '2026-01-01T12:00:00.000Z',
          wpm: 80,
          rawWpm: 88,
          accuracy: 90,
          errorCount: 5,
          durationMs: 15_000,
          validationStatus: 'flagged',
        },
      ],
      loading: false,
      error: null,
    })

    render(<ProfilePage />)

    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('96%')).toBeInTheDocument()
    expect(screen.getByText('0:12')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('flagged')).toBeInTheDocument()
    // The verified run gets no status label at all - only the exception
    // (a non-verified run) is called out.
    expect(screen.queryByText('verified')).not.toBeInTheDocument()
  })

  it('shows verbose stats when runs exist', () => {
    mocks.useProfileStats.mockReturnValue({
      stats: { totalRuns: 12, bestWpm: 105, avgWpm: 90, avgAccuracy: 97 },
      loading: false,
      error: null,
    })

    render(<ProfilePage />)

    expect(screen.getByText('105')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('97%')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('pre-fills the username field and saves an edited value', async () => {
    render(<ProfilePage />)
    const user = userEvent.setup()

    const input = screen.getByLabelText(/username/i)
    expect(input).toHaveValue('alice')

    await user.clear(input)
    await user.type(input, 'newname')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(mocks.update).toHaveBeenCalledWith('user-1', 'newname')
  })

  it('shows a guest-session note for anonymous users', () => {
    mocks.useProfile.mockReturnValue({
      profile: { id: 'user-1', username: 'user_abc123', isAnonymous: true },
      loading: false,
      error: null,
    })

    render(<ProfilePage />)

    expect(screen.getByText(/guest session/i)).toBeInTheDocument()
  })

  it('changes the theme preference when a different option is chosen', async () => {
    render(<ProfilePage />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('radio', { name: /dark/i }))

    expect(mocks.setPreference).toHaveBeenCalledWith('dark')
  })

  it('reflects the current theme preference as the checked radio', () => {
    mocks.useTheme.mockReturnValue({
      preference: 'dark',
      setPreference: mocks.setPreference,
    })

    render(<ProfilePage />)

    expect(screen.getByRole('radio', { name: /dark/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /^system$/i })).not.toBeChecked()
  })
})
