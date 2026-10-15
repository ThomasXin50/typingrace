import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const mocks = vi.hoisted(() => ({
  useProfile: vi.fn(),
  useRoomHeartbeat: vi.fn(),
  useLeaveOnUnload: vi.fn(),
}))

vi.mock('./features/auth/useProfile', () => ({
  useProfile: mocks.useProfile,
}))

vi.mock('./features/multiplayer/useRoomHeartbeat', () => ({
  useRoomHeartbeat: mocks.useRoomHeartbeat,
}))

vi.mock('./features/multiplayer/useLeaveOnUnload', () => ({
  useLeaveOnUnload: mocks.useLeaveOnUnload,
}))

vi.mock('./features/home/useHomeStats', () => ({
  useHomeStats: () => ({ stats: null, loading: false, error: null }),
}))

vi.mock('./features/solo/SoloPage', () => ({
  SoloPage: () => <div>solo page</div>,
}))

vi.mock('./features/practice/PracticePage', () => ({
  PracticePage: () => <div>practice page</div>,
}))

vi.mock('./features/leaderboard/LeaderboardPage', () => ({
  LeaderboardPage: () => <div>leaderboard page</div>,
}))

vi.mock('./features/profile/ProfilePage', () => ({
  ProfilePage: () => <div>profile page</div>,
}))

vi.mock('./features/multiplayer/MultiplayerPage', () => ({
  MultiplayerPage: () => <div>multiplayer page</div>,
}))

vi.mock('./features/multiplayer/RoomPage', () => ({
  RoomPage: () => <div>room page</div>,
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

    expect(screen.getByText(/type a random approved text/i)).toBeInTheDocument()
    expect(
      screen.getByText(/fastest verified runs across every typist/i),
    ).toBeInTheDocument()
  })

  it('mounts room heartbeat and leave-on-unload once, for the whole app lifetime', () => {
    mocks.useProfile.mockReturnValue({
      profile: { id: 'user-1', username: 'alice' },
      loading: false,
      error: null,
    })

    render(<App />)

    expect(mocks.useRoomHeartbeat).toHaveBeenCalledOnce()
    expect(mocks.useLeaveOnUnload).toHaveBeenCalledOnce()
  })

  it('renders the matching page for the current route', () => {
    mocks.useProfile.mockReturnValue({
      profile: { id: 'user-1', username: 'alice' },
      loading: false,
      error: null,
    })
    window.history.pushState({}, '', '/solo')

    render(<App />)

    expect(screen.getByText('solo page')).toBeInTheDocument()
  })
})
