import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RacePage } from './RacePage'

const mocks = vi.hoisted(() => ({
  useActiveRound: vi.fn(),
  useText: vi.fn(),
  useCountdown: vi.fn(),
  useRoundResults: vi.fn(),
  useSubmitRoundRun: vi.fn(),
  submit: vi.fn(),
}))

vi.mock('./useActiveRound', () => ({ useActiveRound: mocks.useActiveRound }))
vi.mock('./useText', () => ({ useText: mocks.useText }))
vi.mock('./useCountdown', () => ({ useCountdown: mocks.useCountdown }))
vi.mock('./useRoundResults', () => ({ useRoundResults: mocks.useRoundResults }))
vi.mock('./useSubmitRoundRun', () => ({
  useSubmitRoundRun: mocks.useSubmitRoundRun,
}))

describe('RacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useRoundResults.mockReturnValue({
      results: [],
      loading: false,
      error: null,
    })
    mocks.useSubmitRoundRun.mockReturnValue({
      submitting: false,
      result: null,
      error: null,
      submit: mocks.submit,
    })
  })

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

  it('submits the keystroke log to the round, not the solo endpoint, once the player finishes', async () => {
    mocks.useActiveRound.mockReturnValue({
      round: {
        id: 'round-1',
        text_id: 'text-1',
        // Realistic: a few seconds before "now", same as a real round's
        // started_at always is - a stale/distant fixture here would give
        // computeWpmSeries an astronomical duration (real Date.now()
        // keystroke timestamps minus a far-past startTimestamp) and blow
        // up trying to bucket it.
        started_at: new Date(Date.now() - 5000).toISOString(),
      },
      loading: false,
      error: null,
    })
    mocks.useText.mockReturnValue({
      content: 'ab',
      loading: false,
      error: null,
    })
    mocks.useCountdown.mockReturnValue({ msRemaining: 0, hasStarted: true })

    render(<RacePage roomId="room-1" />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Typing input'), 'ab')

    expect(mocks.submit).toHaveBeenCalledWith('round-1', expect.any(Array))
  })

  it('shows live results, including still-racing participants, below the typing run', () => {
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
    mocks.useRoundResults.mockReturnValue({
      results: [
        {
          user_id: 'alice',
          status: 'finished',
          validation_status: 'verified',
          wpm: 90,
          placement: 1,
          field_size: 2,
          username: 'alice',
          is_anonymous: false,
        },
        {
          user_id: 'bob',
          status: 'racing',
          validation_status: null,
          wpm: null,
          placement: null,
          field_size: 2,
          username: 'bob',
          is_anonymous: false,
        },
      ],
      loading: false,
      error: null,
    })

    render(<RacePage roomId="room-1" />)

    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('bob')).toBeInTheDocument()
    expect(screen.getByText(/racing/i)).toBeInTheDocument()
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
