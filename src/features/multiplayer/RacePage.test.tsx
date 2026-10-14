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
  useRaceProgress: vi.fn(),
  useProfile: vi.fn(),
  submit: vi.fn(),
  sendProgress: vi.fn(),
}))

vi.mock('./useActiveRound', () => ({ useActiveRound: mocks.useActiveRound }))
vi.mock('./useText', () => ({ useText: mocks.useText }))
vi.mock('./useCountdown', () => ({ useCountdown: mocks.useCountdown }))
vi.mock('./useRoundResults', () => ({ useRoundResults: mocks.useRoundResults }))
vi.mock('./useSubmitRoundRun', () => ({
  useSubmitRoundRun: mocks.useSubmitRoundRun,
}))
vi.mock('./useRaceProgress', () => ({
  useRaceProgress: mocks.useRaceProgress,
}))
vi.mock('../auth/useProfile', () => ({ useProfile: mocks.useProfile }))

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
    mocks.useRaceProgress.mockReturnValue({
      progress: {},
      sendProgress: mocks.sendProgress,
    })
    mocks.useProfile.mockReturnValue({
      profile: { id: 'me', username: 'me', isAnonymous: false },
      loading: false,
      error: null,
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

  it('broadcasts live progress on every keystroke', async () => {
    mocks.useActiveRound.mockReturnValue({
      round: {
        id: 'round-1',
        text_id: 'text-1',
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

    await user.type(screen.getByLabelText('Typing input'), 'a')

    expect(mocks.sendProgress).toHaveBeenCalledWith(0.5)
  })

  it('shows a live progress track for every participant, positioned by their broadcast progress', () => {
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
          status: 'racing',
          validation_status: null,
          wpm: null,
          placement: null,
          field_size: 2,
          username: 'alice',
          is_anonymous: false,
        },
        {
          user_id: 'bob',
          status: 'finished',
          validation_status: 'verified',
          wpm: 80,
          placement: 1,
          field_size: 2,
          username: 'bob',
          is_anonymous: false,
        },
      ],
      loading: false,
      error: null,
    })
    mocks.useRaceProgress.mockReturnValue({
      progress: { alice: 0.3 },
      sendProgress: mocks.sendProgress,
    })

    render(<RacePage roomId="room-1" />)

    const tracks = screen.getAllByTestId('race-track-dot')
    const aliceDot = tracks.find((el) => el.dataset.userId === 'alice')
    const bobDot = tracks.find((el) => el.dataset.userId === 'bob')

    expect(aliceDot).toHaveStyle({ left: '30%' })
    // bob has finished - shown at 100% regardless of their last broadcast.
    expect(bobDot).toHaveStyle({ left: '100%' })
  })

  it("shows placement and wpm alongside a finished participant's track, and nothing but the track itself for one still racing", () => {
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
    expect(screen.getByText('#1 · 90 wpm')).toBeInTheDocument()
    expect(screen.getByText('bob')).toBeInTheDocument()
    // No separate "Racing..." status text anywhere - the track position
    // alone communicates that bob isn't finished yet.
    expect(screen.queryByText(/racing/i)).not.toBeInTheDocument()
  })

  it('shows "You" instead of the current player\'s own username', () => {
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
          user_id: 'me',
          status: 'racing',
          validation_status: null,
          wpm: null,
          placement: null,
          field_size: 2,
          username: 'thomasxin',
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

    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.queryByText('thomasxin')).not.toBeInTheDocument()
    expect(screen.getByText('bob')).toBeInTheDocument()
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
