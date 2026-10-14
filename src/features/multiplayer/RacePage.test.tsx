import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RacePage } from './RacePage'

const mocks = vi.hoisted(() => ({
  useActiveRound: vi.fn(),
  useText: vi.fn(),
  useCountdown: vi.fn(),
}))

vi.mock('./useActiveRound', () => ({ useActiveRound: mocks.useActiveRound }))
vi.mock('./useText', () => ({ useText: mocks.useText }))
vi.mock('./useCountdown', () => ({ useCountdown: mocks.useCountdown }))

describe('RacePage', () => {
  it('shows a loading state while the round is being fetched', () => {
    mocks.useActiveRound.mockReturnValue({
      round: null,
      loading: true,
      error: null,
    })
    mocks.useText.mockReturnValue({
      content: null,
      loading: false,
      error: null,
    })
    mocks.useCountdown.mockReturnValue({ msRemaining: 0, hasStarted: false })

    render(<RacePage roomId="room-1" />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows a countdown before the race starts', () => {
    mocks.useActiveRound.mockReturnValue({
      round: {
        id: 'round-1',
        text_id: 'text-1',
        started_at: '2026-01-01T00:00:05.000Z',
      },
      loading: false,
      error: null,
    })
    mocks.useText.mockReturnValue({
      content: 'the quick brown fox',
      loading: false,
      error: null,
    })
    mocks.useCountdown.mockReturnValue({ msRemaining: 3000, hasStarted: false })

    render(<RacePage roomId="room-1" />)

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByLabelText('Typing input')).not.toBeInTheDocument()
  })

  it('renders the typing run once the countdown has elapsed', () => {
    mocks.useActiveRound.mockReturnValue({
      round: {
        id: 'round-1',
        text_id: 'text-1',
        started_at: '2026-01-01T00:00:05.000Z',
      },
      loading: false,
      error: null,
    })
    mocks.useText.mockReturnValue({
      content: 'the quick brown fox',
      loading: false,
      error: null,
    })
    mocks.useCountdown.mockReturnValue({ msRemaining: 0, hasStarted: true })

    render(<RacePage roomId="room-1" />)

    expect(screen.getByLabelText('Typing input')).toBeInTheDocument()
  })

  it('never passes an "already started" fallback to useCountdown while the round is still loading, which would otherwise flash the typing interface before the countdown renders (useCountdown\'s initial state is seeded once, from whatever it is first called with)', () => {
    mocks.useActiveRound.mockReturnValue({
      round: null,
      loading: true,
      error: null,
    })
    mocks.useText.mockReturnValue({
      content: null,
      loading: false,
      error: null,
    })
    mocks.useCountdown.mockReturnValue({ msRemaining: 0, hasStarted: false })

    render(<RacePage roomId="room-1" />)

    const [calledWith] = mocks.useCountdown.mock.calls[0]
    expect(Date.parse(calledWith)).toBeGreaterThan(Date.now() + 60_000)
  })

  it('shows an error when the round fails to load', () => {
    mocks.useActiveRound.mockReturnValue({
      round: null,
      loading: false,
      error: 'boom',
    })
    mocks.useText.mockReturnValue({
      content: null,
      loading: false,
      error: null,
    })
    mocks.useCountdown.mockReturnValue({ msRemaining: 0, hasStarted: false })

    render(<RacePage roomId="room-1" />)

    expect(screen.getByRole('alert')).toHaveTextContent('boom')
  })
})
