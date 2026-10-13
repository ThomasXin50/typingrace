import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const mocks = vi.hoisted(() => ({
  useProfile: vi.fn(),
}))

vi.mock('./features/auth/useProfile', () => ({
  useProfile: mocks.useProfile,
}))

vi.mock('./features/typing/SoloTypingTest', () => ({
  SoloTypingTest: () => <div>typing test</div>,
}))

vi.mock('./features/leaderboard/LeaderboardPage', () => ({
  LeaderboardPage: () => <div>leaderboard page</div>,
}))

describe('App', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('shows a loading state while auth resolves, with no routes rendered yet', () => {
    mocks.useProfile.mockReturnValue({
      profile: null,
      loading: true,
      error: null,
    })

    render(<App />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows the signed-in username in the nav once auth resolves', () => {
    mocks.useProfile.mockReturnValue({
      profile: { id: 'user-1', username: 'alice' },
      loading: false,
      error: null,
    })

    render(<App />)

    expect(screen.getByText('alice')).toBeInTheDocument()
  })

  it('renders the homepage hub at the root route', () => {
    mocks.useProfile.mockReturnValue({
      profile: { id: 'user-1', username: 'alice' },
      loading: false,
      error: null,
    })

    render(<App />)

    expect(screen.getByText(/type a random text solo/i)).toBeInTheDocument()
    expect(
      screen.getByText(/fastest verified runs across every typist/i),
    ).toBeInTheDocument()
  })

  it('renders the matching page for the current route', () => {
    mocks.useProfile.mockReturnValue({
      profile: { id: 'user-1', username: 'alice' },
      loading: false,
      error: null,
    })
    window.history.pushState({}, '', '/practice')

    render(<App />)

    expect(screen.getByText('typing test')).toBeInTheDocument()
  })
})
