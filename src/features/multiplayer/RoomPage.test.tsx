import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomPage } from './RoomPage'

const mocks = vi.hoisted(() => ({
  useRoom: vi.fn(),
  useLeaveRoom: vi.fn(),
  leaveRoom: vi.fn(),
  navigate: vi.fn(),
  useProfile: vi.fn(),
  useStartRace: vi.fn(),
  startRace: vi.fn(),
  useAddBot: vi.fn(),
  addBot: vi.fn(),
  useRemoveBot: vi.fn(),
  removeBot: vi.fn(),
  setCurrentRoomId: vi.fn(),
  clearCurrentRoomId: vi.fn(),
  RacePage: vi.fn(({ onDone }: { onDone: () => void }) => (
    <div>
      race page
      <button onClick={onDone}>finish race page</button>
    </div>
  )),
}))

vi.mock('./useRoom', () => ({ useRoom: mocks.useRoom }))
vi.mock('./useLeaveRoom', () => ({ useLeaveRoom: mocks.useLeaveRoom }))
vi.mock('../auth/useProfile', () => ({ useProfile: mocks.useProfile }))
vi.mock('./useStartRace', () => ({ useStartRace: mocks.useStartRace }))
vi.mock('./useAddBot', () => ({ useAddBot: mocks.useAddBot }))
vi.mock('./useRemoveBot', () => ({ useRemoveBot: mocks.useRemoveBot }))
vi.mock('./RacePage', () => ({ RacePage: mocks.RacePage }))
vi.mock('./currentRoom', () => ({
  setCurrentRoomId: mocks.setCurrentRoomId,
  clearCurrentRoomId: mocks.clearCurrentRoomId,
}))

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
    mocks.useAddBot.mockReturnValue({
      adding: false,
      error: null,
      addBot: mocks.addBot,
    })
    mocks.useRemoveBot.mockReturnValue({
      removing: false,
      error: null,
      removeBot: mocks.removeBot,
    })
  })

  it('marks this room as the current one once it loads, for the app-level heartbeat/unload-leave hooks to read', () => {
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

    expect(mocks.setCurrentRoomId).toHaveBeenCalledWith('room-1')
  })

  it('clears the current room once it is confirmed gone, so a later visit to /multiplayer does not loop back into a dead room', () => {
    mocks.useRoom.mockReturnValue({
      room: null,
      members: [],
      loading: false,
      error: null,
    })

    renderAt('room-1')

    expect(mocks.clearCurrentRoomId).toHaveBeenCalledOnce()
    expect(mocks.setCurrentRoomId).not.toHaveBeenCalled()
  })

  it('does not clear the current room while it is still loading', () => {
    mocks.useRoom.mockReturnValue({
      room: null,
      members: [],
      loading: true,
      error: null,
    })

    renderAt('room-1')

    expect(mocks.clearCurrentRoomId).not.toHaveBeenCalled()
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

  it('leaves the room immediately (no confirmation) when the leaver is not the host', async () => {
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
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /leave room/i }))

    expect(mocks.leaveRoom).toHaveBeenCalledWith('room-1', expect.any(Function))

    const onLeft = mocks.leaveRoom.mock.calls[0][1]
    onLeft()
    expect(mocks.clearCurrentRoomId).toHaveBeenCalledOnce()
    expect(mocks.navigate).toHaveBeenCalledWith('/multiplayer')
  })

  it('leaves the room immediately (no confirmation) when the host is the only member', async () => {
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
    expect(mocks.clearCurrentRoomId).toHaveBeenCalledOnce()
    expect(mocks.navigate).toHaveBeenCalledWith('/multiplayer')
  })

  it('warns the host before leaving a room with other players present', async () => {
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
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /leave room/i }))

    expect(mocks.leaveRoom).not.toHaveBeenCalled()
    expect(screen.getByText(/you're the host/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(mocks.leaveRoom).not.toHaveBeenCalled()
    expect(screen.queryByText(/you're the host/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /leave room/i }),
    ).toBeInTheDocument()
  })

  it('actually leaves once the host confirms "Leave anyway"', async () => {
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
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /leave room/i }))
    await user.click(screen.getByRole('button', { name: /leave anyway/i }))

    expect(mocks.leaveRoom).toHaveBeenCalledWith('room-1', expect.any(Function))

    const onLeft = mocks.leaveRoom.mock.calls[0][1]
    onLeft()
    expect(mocks.clearCurrentRoomId).toHaveBeenCalledOnce()
    expect(mocks.navigate).toHaveBeenCalledWith('/multiplayer')
  })

  it('dismisses the leave confirmation if the room drops back to a solo host while it is showing (nothing left to warn about transferring)', async () => {
    const baseRoom = {
      id: 'room-1',
      host_id: 'alice',
      status: 'lobby' as const,
      max_players: 8,
      difficulty_filter: 'all' as const,
      join_code: 'ABC123',
    }

    mocks.useRoom.mockReturnValue({
      room: baseRoom,
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

    const { rerender } = renderAt('room-1')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /leave room/i }))
    expect(screen.getByText(/you're the host/i)).toBeInTheDocument()

    // Bob disconnects (or leaves, or stalls out) while alice is still
    // looking at the confirmation.
    mocks.useRoom.mockReturnValue({
      room: baseRoom,
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
    rerender(
      <MemoryRouter initialEntries={['/multiplayer/room-1']}>
        <Routes>
          <Route path="/multiplayer/:roomId" element={<RoomPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByText(/you're the host/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /leave room/i }),
    ).toBeInTheDocument()
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

  it("passes the room's bots through to RacePage", () => {
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
      bots: [{ id: 'bot-1', personality: 'coder' }],
      loading: false,
      error: null,
    })

    renderAt('room-1')

    expect(mocks.RacePage).toHaveBeenCalledWith(
      expect.objectContaining({
        bots: [{ id: 'bot-1', personality: 'coder' }],
      }),
      undefined,
    )
  })

  it('keeps showing the race page even after room.status flips back to lobby, until the race page itself signals it is done (so a just-finished player keeps seeing their results instead of being yanked back to the lobby the instant everyone else finishes too)', () => {
    const racingRoom = {
      id: 'room-1',
      host_id: 'alice',
      status: 'racing' as const,
      max_players: 8,
      difficulty_filter: 'all' as const,
      join_code: 'ABC123',
    }
    const members = [
      {
        user_id: 'alice',
        status: 'active' as const,
        joined_at: 't1',
        username: 'alice',
        is_anonymous: false,
      },
    ]

    mocks.useRoom.mockReturnValue({
      room: racingRoom,
      members,
      loading: false,
      error: null,
    })
    const { rerender } = renderAt('room-1')

    expect(screen.getByText('race page')).toBeInTheDocument()

    // The room finishes and returns to 'lobby' (everyone has submitted) -
    // the race page must not disappear on its own from this alone.
    mocks.useRoom.mockReturnValue({
      room: { ...racingRoom, status: 'lobby' },
      members,
      loading: false,
      error: null,
    })
    rerender(
      <MemoryRouter initialEntries={['/multiplayer/room-1']}>
        <Routes>
          <Route path="/multiplayer/:roomId" element={<RoomPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('race page')).toBeInTheDocument()
    expect(screen.queryByText('ABC123')).not.toBeInTheDocument()
  })

  it('returns to the lobby once the race page calls onDone (by which point room.status has already flipped back to lobby in practice)', async () => {
    const baseRoom = {
      id: 'room-1',
      host_id: 'alice',
      max_players: 8,
      difficulty_filter: 'all' as const,
      join_code: 'ABC123',
    }
    const members = [
      {
        user_id: 'alice',
        status: 'active' as const,
        joined_at: 't1',
        username: 'alice',
        is_anonymous: false,
      },
    ]

    mocks.useRoom.mockReturnValue({
      room: { ...baseRoom, status: 'racing' as const },
      members,
      loading: false,
      error: null,
    })
    const { rerender } = renderAt('room-1')
    expect(screen.getByText('race page')).toBeInTheDocument()

    mocks.useRoom.mockReturnValue({
      room: { ...baseRoom, status: 'lobby' as const },
      members,
      loading: false,
      error: null,
    })
    rerender(
      <MemoryRouter initialEntries={['/multiplayer/room-1']}>
        <Routes>
          <Route path="/multiplayer/:roomId" element={<RoomPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('race page')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /finish race page/i }))

    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(screen.queryByText('race page')).not.toBeInTheDocument()
  })

  describe('roster join/leave and host-transfer motion', () => {
    const baseRoom = {
      id: 'room-1',
      host_id: 'alice',
      status: 'lobby' as const,
      max_players: 8,
      difficulty_filter: 'all' as const,
      join_code: 'ABC123',
    }

    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('keeps a departing member rendered with a leaving class before dropping them, instead of vanishing instantly', () => {
      mocks.useRoom.mockReturnValue({
        room: baseRoom,
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

      const { rerender } = renderAt('room-1')
      expect(screen.getByText('bob')).toBeInTheDocument()

      mocks.useRoom.mockReturnValue({
        room: baseRoom,
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
      rerender(
        <MemoryRouter initialEntries={['/multiplayer/room-1']}>
          <Routes>
            <Route path="/multiplayer/:roomId" element={<RoomPage />} />
          </Routes>
        </MemoryRouter>,
      )

      // Bob is gone from the room data but still on screen, mid-exit.
      expect(screen.getByText('bob').closest('li')?.className).toContain(
        'room-roster__item--leaving',
      )

      act(() => {
        vi.advanceTimersByTime(250)
      })

      expect(screen.queryByText('bob')).not.toBeInTheDocument()
    })

    it('flashes the roster row that just became the new host', () => {
      const members = [
        {
          user_id: 'alice',
          status: 'active' as const,
          joined_at: 't1',
          username: 'alice',
          is_anonymous: false,
        },
        {
          user_id: 'bob',
          status: 'active' as const,
          joined_at: 't2',
          username: 'bob',
          is_anonymous: false,
        },
      ]

      mocks.useRoom.mockReturnValue({
        room: baseRoom,
        members,
        loading: false,
        error: null,
      })

      const { rerender } = renderAt('room-1')
      expect(screen.getByText('bob').closest('li')?.className).not.toContain(
        'attention-flash',
      )

      // Alice leaves; bob is promoted to host.
      mocks.useRoom.mockReturnValue({
        room: { ...baseRoom, host_id: 'bob' },
        members: [members[1]],
        loading: false,
        error: null,
      })
      rerender(
        <MemoryRouter initialEntries={['/multiplayer/room-1']}>
          <Routes>
            <Route path="/multiplayer/:roomId" element={<RoomPage />} />
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('bob').closest('li')?.className).toContain(
        'attention-flash',
      )

      act(() => {
        vi.advanceTimersByTime(900)
      })

      expect(screen.getByText('bob').closest('li')?.className).not.toContain(
        'attention-flash',
      )
    })

    it('does not flash anyone on first render, only on an actual host change', () => {
      mocks.useRoom.mockReturnValue({
        room: baseRoom,
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

      expect(screen.getByText('alice').closest('li')?.className).not.toContain(
        'attention-flash',
      )
    })
  })

  describe('bots', () => {
    const baseRoom = {
      id: 'room-1',
      host_id: 'alice',
      status: 'lobby' as const,
      max_players: 8,
      difficulty_filter: 'all' as const,
      join_code: 'ABC123',
    }
    const aliceMember = {
      user_id: 'alice',
      status: 'active' as const,
      joined_at: 't1',
      username: 'alice',
      is_anonymous: false,
    }

    it("renders a bot's personality name in the roster", () => {
      mocks.useRoom.mockReturnValue({
        room: baseRoom,
        members: [aliceMember],
        bots: [{ id: 'bot-1', personality: 'coder' }],
        loading: false,
        error: null,
      })

      renderAt('room-1')

      expect(
        within(screen.getByRole('list')).getByText('The Coder'),
      ).toBeInTheDocument()
    })

    it('disambiguates bots that share a personality', () => {
      mocks.useRoom.mockReturnValue({
        room: baseRoom,
        members: [aliceMember],
        bots: [
          { id: 'bot-1111', personality: 'coder' },
          { id: 'bot-2222', personality: 'coder' },
        ],
        loading: false,
        error: null,
      })

      renderAt('room-1')

      expect(screen.getByText('The Coder #1111')).toBeInTheDocument()
      expect(screen.getByText('The Coder #2222')).toBeInTheDocument()
    })

    it('shows a Remove button for a bot only to the host', () => {
      mocks.useRoom.mockReturnValue({
        room: baseRoom,
        members: [
          aliceMember,
          {
            user_id: 'bob',
            status: 'active' as const,
            joined_at: 't2',
            username: 'bob',
            is_anonymous: false,
          },
        ],
        bots: [{ id: 'bot-1', personality: 'typist' }],
        loading: false,
        error: null,
      })

      renderAt('room-1')
      expect(
        screen.getByRole('button', { name: /remove/i }),
      ).toBeInTheDocument()
    })

    it('does not show a Remove button for a bot to a non-host', () => {
      mocks.useProfile.mockReturnValue({
        profile: { id: 'bob', username: 'bob', isAnonymous: false },
        loading: false,
        error: null,
      })
      mocks.useRoom.mockReturnValue({
        room: baseRoom,
        members: [
          aliceMember,
          {
            user_id: 'bob',
            status: 'active' as const,
            joined_at: 't2',
            username: 'bob',
            is_anonymous: false,
          },
        ],
        bots: [{ id: 'bot-1', personality: 'typist' }],
        loading: false,
        error: null,
      })

      renderAt('room-1')

      expect(
        screen.queryByRole('button', { name: /remove/i }),
      ).not.toBeInTheDocument()
    })

    it('removes a bot when the host clicks Remove', async () => {
      mocks.useRoom.mockReturnValue({
        room: baseRoom,
        members: [aliceMember],
        bots: [{ id: 'bot-1', personality: 'typist' }],
        loading: false,
        error: null,
      })
      const user = userEvent.setup()

      renderAt('room-1')
      await user.click(screen.getByRole('button', { name: /remove/i }))

      expect(mocks.removeBot).toHaveBeenCalledWith('room-1', 'bot-1')
    })

    it('shows an add-bot control only to the host', () => {
      mocks.useRoom.mockReturnValue({
        room: baseRoom,
        members: [aliceMember],
        bots: [],
        loading: false,
        error: null,
      })

      renderAt('room-1')

      expect(
        screen.getByRole('button', { name: /add bot/i }),
      ).toBeInTheDocument()
    })

    it('does not show the add-bot control to a non-host', () => {
      mocks.useProfile.mockReturnValue({
        profile: { id: 'bob', username: 'bob', isAnonymous: false },
        loading: false,
        error: null,
      })
      mocks.useRoom.mockReturnValue({
        room: baseRoom,
        members: [
          aliceMember,
          {
            user_id: 'bob',
            status: 'active' as const,
            joined_at: 't2',
            username: 'bob',
            is_anonymous: false,
          },
        ],
        bots: [],
        loading: false,
        error: null,
      })

      renderAt('room-1')

      expect(
        screen.queryByRole('button', { name: /add bot/i }),
      ).not.toBeInTheDocument()
    })

    it('adds a bot with the selected personality', async () => {
      mocks.useRoom.mockReturnValue({
        room: baseRoom,
        members: [aliceMember],
        bots: [],
        loading: false,
        error: null,
      })
      const user = userEvent.setup()

      renderAt('room-1')
      await user.selectOptions(
        screen.getByLabelText(/bot personality/i),
        'typist',
      )
      await user.click(screen.getByRole('button', { name: /add bot/i }))

      expect(mocks.addBot).toHaveBeenCalledWith('room-1', 'typist')
    })

    it('adds a random bot when the picker is left on its default', async () => {
      mocks.useRoom.mockReturnValue({
        room: baseRoom,
        members: [aliceMember],
        bots: [],
        loading: false,
        error: null,
      })
      const user = userEvent.setup()

      renderAt('room-1')
      await user.click(screen.getByRole('button', { name: /add bot/i }))

      expect(mocks.addBot).toHaveBeenCalledWith('room-1', undefined)
    })

    it('disables the add-bot button once the room has the maximum number of bots', () => {
      mocks.useRoom.mockReturnValue({
        room: baseRoom,
        members: [aliceMember],
        bots: [
          { id: 'bot-1', personality: 'coder' },
          { id: 'bot-2', personality: 'typist' },
          { id: 'bot-3', personality: 'monkeytyper' },
        ],
        loading: false,
        error: null,
      })

      renderAt('room-1')

      expect(screen.getByRole('button', { name: /add bot/i })).toBeDisabled()
    })
  })
})
