import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MultiplayerPage } from './MultiplayerPage'

const mocks = vi.hoisted(() => ({
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  useCreateRoom: vi.fn(),
  useJoinRoom: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('./useCreateRoom', () => ({ useCreateRoom: mocks.useCreateRoom }))
vi.mock('./useJoinRoom', () => ({ useJoinRoom: mocks.useJoinRoom }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mocks.navigate }
})

function renderPage() {
  return render(
    <MemoryRouter>
      <MultiplayerPage />
    </MemoryRouter>,
  )
}

describe('MultiplayerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useCreateRoom.mockReturnValue({
      creating: false,
      room: null,
      error: null,
      createRoom: mocks.createRoom,
    })
    mocks.useJoinRoom.mockReturnValue({
      joining: false,
      room: null,
      error: null,
      joinRoom: mocks.joinRoom,
    })
  })

  it('creates a room on click', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /create a room/i }))

    expect(mocks.createRoom).toHaveBeenCalledOnce()
  })

  it('navigates to the room once one is created', () => {
    mocks.useCreateRoom.mockReturnValue({
      creating: false,
      room: { id: 'room-1', joinCode: 'ABC123' },
      error: null,
      createRoom: mocks.createRoom,
    })

    renderPage()

    expect(mocks.navigate).toHaveBeenCalledWith('/multiplayer/room-1')
  })

  it('joins a room by code', async () => {
    renderPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/room code/i), 'abc123')
    await user.click(screen.getByRole('button', { name: /^join$/i }))

    expect(mocks.joinRoom).toHaveBeenCalledWith('abc123')
  })

  it('navigates to the room once joined', () => {
    mocks.useJoinRoom.mockReturnValue({
      joining: false,
      room: { id: 'room-2', joinCode: 'XYZ999' },
      error: null,
      joinRoom: mocks.joinRoom,
    })

    renderPage()

    expect(mocks.navigate).toHaveBeenCalledWith('/multiplayer/room-2')
  })

  it('shows an error when joining fails', () => {
    mocks.useJoinRoom.mockReturnValue({
      joining: false,
      room: null,
      error: 'room not found',
      joinRoom: mocks.joinRoom,
    })

    renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent('room not found')
  })
})
