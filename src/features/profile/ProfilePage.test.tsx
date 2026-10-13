import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'

const mocks = vi.hoisted(() => ({
  useProfile: vi.fn(),
  useProfileStats: vi.fn(),
  useTheme: vi.fn(),
  setPreference: vi.fn(),
  update: vi.fn(),
  useUpdateUsername: vi.fn(),
}))

vi.mock('../auth/useProfile', () => ({ useProfile: mocks.useProfile }))
vi.mock('./useProfileStats', () => ({ useProfileStats: mocks.useProfileStats }))
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

  it('renders Profile and Settings sections in order, with a divider before the settings controls', () => {
    render(<ProfilePage />)

    const headings = screen.getAllByRole('heading').map((h) => h.textContent)
    expect(headings).toEqual(['Profile', 'Settings'])
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('shows an empty state when there are no runs yet', () => {
    render(<ProfilePage />)

    expect(screen.getByText(/no runs yet/i)).toBeInTheDocument()
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
