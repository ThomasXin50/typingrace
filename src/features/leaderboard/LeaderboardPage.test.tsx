import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { LeaderboardPage } from './LeaderboardPage'

const mocks = vi.hoisted(() => ({
  useLeaderboard: vi.fn(),
}))

vi.mock('./useLeaderboard', () => ({
  useLeaderboard: mocks.useLeaderboard,
}))

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('LeaderboardPage', () => {
  it('shows a loading state', () => {
    mocks.useLeaderboard.mockReturnValue({
      entries: [],
      loading: true,
      error: null,
    })

    renderWithRouter(<LeaderboardPage />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows an empty state teaching the interface when there are no runs yet', () => {
    mocks.useLeaderboard.mockReturnValue({
      entries: [],
      loading: false,
      error: null,
    })

    renderWithRouter(<LeaderboardPage />)

    expect(screen.getByText(/no runs yet/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /start practicing/i }),
    ).toHaveAttribute('href', '/practice')
  })

  it('renders ranked entries', () => {
    mocks.useLeaderboard.mockReturnValue({
      entries: [
        {
          user_id: 'a',
          username: 'alice',
          runs: 5,
          avg_wpm: 70,
          best_wpm: 90,
          rank: 1,
          is_anonymous: false,
        },
        {
          user_id: 'b',
          username: 'bob',
          runs: 2,
          avg_wpm: 50,
          best_wpm: 60,
          rank: 2,
          is_anonymous: false,
        },
      ],
      loading: false,
      error: null,
    })

    renderWithRouter(<LeaderboardPage />)

    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getByText('bob')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
  })

  it('shows a lone anonymous entry as plain "Guest", never its generated username', () => {
    mocks.useLeaderboard.mockReturnValue({
      entries: [
        {
          user_id: 'aaaaaaaa-0000-0000-0000-00000000aaaa',
          username: 'user_aaaaaaaa00000000000000000000aaaa',
          runs: 3,
          avg_wpm: 60,
          best_wpm: 65,
          rank: 1,
          is_anonymous: true,
        },
      ],
      loading: false,
      error: null,
    })

    renderWithRouter(<LeaderboardPage />)

    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(screen.queryByText(/user_aaaa/)).not.toBeInTheDocument()
  })

  it('disambiguates multiple anonymous entries with a short id-derived suffix', () => {
    mocks.useLeaderboard.mockReturnValue({
      entries: [
        {
          user_id: 'aaaaaaaa-0000-0000-0000-00000000aaaa',
          username: 'user_a',
          runs: 3,
          avg_wpm: 60,
          best_wpm: 65,
          rank: 1,
          is_anonymous: true,
        },
        {
          user_id: 'bbbbbbbb-0000-0000-0000-00000000bbbb',
          username: 'user_b',
          runs: 1,
          avg_wpm: 40,
          best_wpm: 40,
          rank: 2,
          is_anonymous: true,
        },
      ],
      loading: false,
      error: null,
    })

    renderWithRouter(<LeaderboardPage />)

    expect(screen.getByText('Guest aaaa')).toBeInTheDocument()
    expect(screen.getByText('Guest bbbb')).toBeInTheDocument()
  })

  it('shows an error state', () => {
    mocks.useLeaderboard.mockReturnValue({
      entries: [],
      loading: false,
      error: 'boom',
    })

    renderWithRouter(<LeaderboardPage />)

    expect(screen.getByRole('alert')).toHaveTextContent('boom')
  })
})
