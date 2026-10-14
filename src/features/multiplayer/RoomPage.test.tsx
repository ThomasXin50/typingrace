import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomPage } from './RoomPage'

const mocks = vi.hoisted(() => ({
  useRoom: vi.fn(),
  useLeaveRoom: vi.fn(),
  leaveRoom: vi.fn(),
  navigate: vi.fn(),
  useProfile: vi.fn(),
  useStartRace: vi.fn(),
  startRace: vi.fn(),
  RacePage: vi.fn(() => <div>race page</div>),
}))

vi.mock('./useRoom', () => ({ useRoom: mocks.useRoom }))
vi.mock('./useLeaveRoom', () => ({ useLeaveRoom: mocks.useLeaveRoom }))
vi.mock('../auth/useProfile', () => ({ useProfile: mocks.useProfile }))
vi.mock('./useStartRace', () => ({ useStartRace: mocks.useStartRace }))
vi.mock('./RacePage', () => ({ RacePage: mocks.RacePage }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mocks.navigate }
})

function renderAt(roomId: string) {
  return render(
    <MemoryRouter initialEntries={[`/multiplayer/${roomId}`]}>
      <Routes>
        <Route path="/multiplayer/:roomId" element={<RoomPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RoomPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useLeaveRoom.mockReturnValue({
      leaving: false,
      error: null,
      leaveRoom: mocks.leaveRoom,
    })
    mocks.useProfile.mockReturnValue({
      profile: { id: 'alice', username: 'alice', isAnonymous: false },
      loading: false,
      error: null,
    })
    mocks.useStartRace.mockReturnValue({
      starting: false,
      round: null,
      error: null,
      startRace: mocks.startRace,
    })
  })

  it('shows a loading state', () => {
    mocks.useRoom.mockReturnValue({
      room: null,
      members: [],
      loading: true,
      error: null,
    })

    renderAt('room-1')

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows the join code and roster', () => {
    mocks.useRoom.mockReturnValue({
      room: {
        id: 'room-1',
        host_id: 'alice',
        status: 'lobby',
        max_players: 8,
        difficulty_filter: 'all',
        join_code: 'ABC123',
      },
      members: [
        {
          user_id: 'alice',
          status: 'active',
          joined_at: 't1',
          username: 'alice',
          is_anonymous: false,
        },
        {
          user_id: 'bob',
          status: 'active',
          joined_at: 't2',
          username: 'user_bob',
          is_anonymous: true,
        },
      ],
      loading: false,
      error: null,
    })

    renderAt('room-1')

    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(screen.getByText(/host/i)).toBeInTheDocument()
  })

  it('disambiguates multiple guests in the roster', () => {
    mocks.useRoom.mockReturnValue({
      room: {
        id: 'room-1',
        host_id: 'aaaaaaaa-0000-0000-0000-00000000aaaa',
        status: 'lobby',
        max_players: 8,
        difficulty_filter: 'all',
        join_code: 'ABC123',
      },
      members: [
        {
          user_id: 'aaaaaaaa-0000-0000-0000-00000000aaaa',
          status: 'active',
          joined_at: 't1',
          username: 'user_a',
          is_anonymous: true,
        },
        {
          user_id: 'bbbbbbbb-0000-0000-0000-00000000bbbb',
          status: 'active',
          joined_at: 't2',
          username: 'user_b',
          is_anonymous: true,
        },
      ],
      loading: false,
      error: null,
    })

    renderAt('room-1')

    expect(screen.getByText('Guest aaaa')).toBeInTheDocument()
    expect(screen.getByText('Guest bbbb')).toBeInTheDocument()
  })

  it('leaves the room and navigates back to the multiplayer entry', async () => {
    mocks.useRoom.mockReturnValue({
      room: {
        id: 'room-1',
        host_id: 'alice',
        status: 'lobby',
        max_players: 8,
        difficulty_filter: 'all',
        join_code: 'ABC123',
      },
      members: [
        {
          user_id: 'alice',
          status: 'active',
          joined_at: 't1',
          username: 'alice',
          is_anonymous: false,
        },
      ],
      loading: false,
      error: null,
    })

    renderAt('room-1')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /leave room/i }))

    expect(mocks.leaveRoom).toHaveBeenCalledWith('room-1', expect.any(Function))

    const onLeft = mocks.leaveRoom.mock.calls[0][1]
    onLeft()
    expect(mocks.navigate).toHaveBeenCalledWith('/multiplayer')
  })

  it('shows a Start Race button for the host, which starts the race on click', async () => {
    mocks.useRoom.mockReturnValue({
      room: {
        id: 'room-1',
        host_id: 'alice',
        status: 'lobby',
        max_players: 8,
        difficulty_filter: 'all',
        join_code: 'ABC123',
      },
      members: [
        {
          user_id: 'alice',
          status: 'active',
          joined_at: 't1',
          username: 'alice',
          is_anonymous: false,
        },
      ],
      loading: false,
      error: null,
    })

    renderAt('room-1')
    const user = userEvent.setup()

    const button = screen.getByRole('button', { name: /start race/i })
    await user.click(button)

    expect(mocks.startRace).toHaveBeenCalledWith('room-1')
  })

  it('does not show a Start Race button for a non-host', () => {
    mocks.useProfile.mockReturnValue({
      profile: { id: 'bob', username: 'bob', isAnonymous: false },
      loading: false,
      error: null,
    })
    mocks.useRoom.mockReturnValue({
      room: {
        id: 'room-1',
        host_id: 'alice',
        status: 'lobby',
        max_players: 8,
        difficulty_filter: 'all',
        join_code: 'ABC123',
      },
      members: [
        {
          user_id: 'alice',
          status: 'active',
          joined_at: 't1',
          username: 'alice',
          is_anonymous: false,
        },
        {
          user_id: 'bob',
          status: 'active',
          joined_at: 't2',
          username: 'bob',
          is_anonymous: false,
        },
      ],
      loading: false,
      error: null,
    })

    renderAt('room-1')

    expect(
      screen.queryByRole('button', { name: /start race/i }),
    ).not.toBeInTheDocument()
  })

  it('renders the race page instead of the lobby once the room is racing', () => {
    mocks.useRoom.mockReturnValue({
      room: {
        id: 'room-1',
        host_id: 'alice',
        status: 'racing',
        max_players: 8,
        difficulty_filter: 'all',
        join_code: 'ABC123',
      },
      members: [
        {
          user_id: 'alice',
          status: 'active',
          joined_at: 't1',
          username: 'alice',
          is_anonymous: false,
        },
      ],
      loading: false,
      error: null,
    })

    renderAt('room-1')

    expect(screen.getByText('race page')).toBeInTheDocument()
    expect(screen.queryByText('ABC123')).not.toBeInTheDocument()
  })
})
