import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RacePage } from './RacePage'

const mocks = vi.hoisted(() => ({
  useActiveRound: vi.fn(),
  useText: vi.fn(),
  useCountdown: vi.fn(),
  useRoundResults: vi.fn(),
  useSubmitRoundRun: vi.fn(),
  useRaceProgress: vi.fn(),
  useProfile: vi.fn(),
  useStallWatcher: vi.fn(),
  useStallRoundParticipant: vi.fn(),
  submit: vi.fn(),
  sendProgress: vi.fn(),
  ping: vi.fn(),
  stall: vi.fn(),
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
vi.mock('./useStallWatcher', () => ({ useStallWatcher: mocks.useStallWatcher }))
vi.mock('./useStallRoundParticipant', () => ({
  useStallRoundParticipant: mocks.useStallRoundParticipant,
}))

describe('RacePage', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

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
    mocks.useStallWatcher.mockReturnValue(mocks.ping)
    mocks.useStallRoundParticipant.mockReturnValue({
      stalling: false,
      error: null,
      stall: mocks.stall,
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

  it('keeps showing the finished run and results instead of reverting to "waiting for the race to start" once the round disappears from useActiveRound (its own query only ever returns the still-active round, which stops matching the moment everyone finishes)', async () => {
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

    const { rerender } = render(<RacePage roomId="room-1" />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Typing input'), 'ab')

    expect(screen.getByText('wpm')).toBeInTheDocument()

    mocks.useActiveRound.mockReturnValue({
      round: null,
      loading: false,
      error: null,
    })
    rerender(<RacePage roomId="room-1" />)

    expect(screen.getByText('wpm')).toBeInTheDocument()
    expect(
      screen.queryByText(/waiting for the race to start/i),
    ).not.toBeInTheDocument()
  })

  it('does not start the "back to lobby" countdown just because this player personally finished - other participants may still be racing', () => {
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
    const input = screen.getByLabelText('Typing input')

    fireEvent.keyDown(input, { key: 'a' })
    fireEvent.keyDown(input, { key: 'b' })

    expect(screen.getByText('wpm')).toBeInTheDocument()
    expect(screen.queryByText(/back to lobby in/i)).not.toBeInTheDocument()
  })

  it('starts the "back to lobby" countdown once the round itself closes out (not before), and calls onDone once it elapses - so every participant leaves together once the round is actually done, rather than whenever each of them personally happens to finish typing', () => {
    // Fake timers from the start, before anything schedules a real
    // setTimeout - switching to fake timers partway through would orphan
    // whatever real timer the finish effect already scheduled, leaving
    // nothing for advanceTimersByTime to actually advance. fireEvent
    // (rather than userEvent, which relies on its own real internal
    // delays) keeps typing itself synchronous under fake timers.
    vi.useFakeTimers()
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
    const onDone = vi.fn()

    const { rerender } = render(<RacePage roomId="room-1" onDone={onDone} />)
    const input = screen.getByLabelText('Typing input')

    fireEvent.keyDown(input, { key: 'a' })
    fireEvent.keyDown(input, { key: 'b' })

    expect(screen.queryByText(/back to lobby in/i)).not.toBeInTheDocument()

    // The round closes out once everyone (not just this player) has
    // finished - useActiveRound's own query, which only ever matches a
    // still-'active' round, stops returning it.
    mocks.useActiveRound.mockReturnValue({
      round: null,
      loading: false,
      error: null,
    })
    rerender(<RacePage roomId="room-1" onDone={onDone} />)

    expect(screen.getByText(/back to lobby in/i)).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()

    // One second at a time, not a single big jump: the countdown chains
    // through setTimeout -> state update -> effect re-run -> next
    // setTimeout, and advancing past multiple links in one sweep races
    // ahead of React's re-render, which is what actually schedules each
    // next timer in the chain.
    for (let i = 0; i < 10; i++) {
      act(() => {
        vi.advanceTimersByTime(1000)
      })
    }

    expect(onDone).toHaveBeenCalledOnce()
  })

  it('swaps the typing interface for a spectate message and reports the stall, once the idle watcher fires', () => {
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

    const { onStall } = mocks.useStallWatcher.mock.calls.at(-1)![0]
    act(() => {
      onStall()
    })

    expect(screen.queryByLabelText('Typing input')).not.toBeInTheDocument()
    expect(screen.getByText(/stalled out/i)).toBeInTheDocument()
    expect(mocks.stall).toHaveBeenCalledWith('round-1')
  })

  it('stops watching for a stall once this player has already finished', () => {
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
    mocks.useSubmitRoundRun.mockReturnValue({
      submitting: false,
      result: { status: 'verified', placement: 1, fieldSize: 2 },
      error: null,
      submit: mocks.submit,
    })

    render(<RacePage roomId="room-1" />)

    const { active } = mocks.useStallWatcher.mock.calls.at(-1)![0]
    expect(active).toBe(false)
  })

  it("marks a stalled participant's track with a text indicator, not color alone", () => {
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
          status: 'stalled',
          validation_status: null,
          wpm: null,
          placement: null,
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

    expect(screen.getByText(/alice.*\(stalled\)/i)).toBeInTheDocument()
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
