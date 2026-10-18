import { useEffect, useState } from 'react'
import { displayName } from '../../lib/displayName'
import { useProfile } from '../auth/useProfile'
import { TypingRun } from '../typing/TypingRun'
import type { Keystroke } from '../typing/useTypingEngine'
import { useActiveRound, type RoundRow } from './useActiveRound'
import { useCountdown } from './useCountdown'
import { useRaceProgress } from './useRaceProgress'
import { useRoundResults } from './useRoundResults'
import { useStallRoundParticipant } from './useStallRoundParticipant'
import { useStallWatcher } from './useStallWatcher'
import { useSubmitRoundRun } from './useSubmitRoundRun'
import { useText } from './useText'
import './multiplayer.css'

interface RacePageProps {
  roomId: string
  /** Called once this player's post-finish grace period has elapsed - the
   * parent (RoomPage) owns actually leaving the race view; this never
   * navigates on its own. */
  onDone?: () => void
}

// A placeholder for useCountdown while the round hasn't loaded yet - any
// fixed date far enough in the future works, since it's only ever replaced
// by the real round.started_at once data arrives (never displayed or used
// for real countdown math). Must be a static value, not e.g. Date.now() +
// margin: React requires render to stay pure, and useCountdown's initial
// state is seeded once from whatever it's first called with, so this needs
// to read as "not started" immediately, on the very first render.
const PENDING_ROUND_PLACEHOLDER = '2099-01-01T00:00:00.000Z'

const BACK_TO_LOBBY_SECONDS = 8

export function RacePage({ roomId, onDone }: RacePageProps) {
  const {
    round,
    loading: roundLoading,
    error: roundError,
  } = useActiveRound(roomId)
  const {
    content,
    loading: textLoading,
    error: textError,
  } = useText(round?.text_id ?? null)

  // Frozen on the last known non-null value: useActiveRound's own query
  // only ever matches the room's currently 'active' round, which stops
  // matching the instant the round closes out (everyone's finished).
  // Without this, finishing would show results for a moment, then
  // immediately revert to "Waiting for the race to start..." as soon as
  // that happens - exactly the window this page needs to stay stable
  // through so a player can see their own results.
  const [frozenRound, setFrozenRound] = useState<RoundRow | null>(null)
  const [frozenContent, setFrozenContent] = useState<string | null>(null)
  if (round && round !== frozenRound) setFrozenRound(round)
  if (content && content !== frozenContent) setFrozenContent(content)
  const effectiveRound = frozenRound ?? round
  const effectiveContent = frozenContent ?? content

  const countdown = useCountdown(
    effectiveRound?.started_at ?? PENDING_ROUND_PLACEHOLDER,
  )
  const { results } = useRoundResults(effectiveRound?.id ?? null)
  const submitRoundRun = useSubmitRoundRun()
  const { profile } = useProfile()
  const { progress, sendProgress } = useRaceProgress(
    effectiveRound?.id ?? null,
    profile?.id ?? null,
  )

  // True once the live round has closed out - not "this player personally
  // finished" (others may still be racing when that happens). Everyone
  // hits this transition together, from the same shared signal (the round
  // leaving 'active'), which is what makes the countdown below actually
  // synchronized across participants instead of starting independently
  // whenever each of them happens to finish typing.
  const [roundClosed, setRoundClosed] = useState(false)
  if (effectiveRound && !round && !roundClosed) setRoundClosed(true)

  const [isStalled, setIsStalled] = useState(false)
  const stallRoundParticipant = useStallRoundParticipant()
  // Armed the instant the race actually starts (not waiting for a first
  // keystroke that might never come), disarmed once this player has
  // genuinely finished or the round has already closed - either way,
  // there's nothing left to watch for.
  const stallWatcherActive =
    countdown.hasStarted && !roundClosed && !submitRoundRun.result && !isStalled
  const ping = useStallWatcher({
    active: stallWatcherActive,
    onStall: () => {
      setIsStalled(true)
      stallRoundParticipant.stall(effectiveRound!.id)
    },
  })

  const [lobbyCountdown, setLobbyCountdown] = useState(BACK_TO_LOBBY_SECONDS)

  useEffect(() => {
    if (!roundClosed) return
    if (lobbyCountdown <= 0) {
      onDone?.()
      return
    }
    const timer = setTimeout(() => setLobbyCountdown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [roundClosed, lobbyCountdown, onDone])

  if (roundLoading || (round && textLoading)) {
    return <p className="page-status">Loading race…</p>
  }

  const error = roundError ?? textError
  if (error) {
    return (
      <p className="page-status" role="alert">
        {error}
      </p>
    )
  }

  if (!effectiveRound || !effectiveContent) {
    return <p className="page-status">Waiting for the race to start…</p>
  }

  if (!countdown.hasStarted) {
    const secondsLeft = Math.ceil(countdown.msRemaining / 1000)
    return (
      <div className="race-countdown">
        <p className="race-countdown__label">Starting in</p>
        {/* Keyed by the displayed digit (not the raw tick, which fires
            every 200ms) so the pulse animation replays fresh exactly once
            per second, via a plain remount rather than a JS-driven
            restart. */}
        <span key={secondsLeft} className="race-countdown__number">
          {secondsLeft}
        </span>
      </div>
    )
  }

  function handleFinish(keystrokes: Keystroke[]) {
    submitRoundRun.submit(effectiveRound!.id, keystrokes)
  }

  function handleProgress(progressPct: number) {
    sendProgress(progressPct)
    ping()
  }

  return (
    <div className="race-page">
      {isStalled ? (
        <p className="page-status">
          You stalled out — spectating the rest of this round…
        </p>
      ) : (
        <TypingRun
          content={effectiveContent}
          now={() => Date.now()}
          startTimestamp={Date.parse(effectiveRound.started_at)}
          onFinish={handleFinish}
          onProgress={handleProgress}
        />
      )}

      {results.length > 0 && (
        <ul className="race-tracks">
          {results.map((r) => {
            const pct = r.status === 'finished' ? 1 : (progress[r.user_id] ?? 0)
            const isSelf = r.user_id === profile?.id
            const hasResult = r.placement !== null && r.wpm !== null
            const isRowStalled = r.status === 'stalled'
            return (
              <li
                key={r.user_id}
                className={
                  isRowStalled ? 'race-track race-track--stalled' : 'race-track'
                }
              >
                <span className="race-track__name">
                  {isSelf ? 'You' : displayName(r, results)}
                  {isRowStalled ? ' (stalled)' : ''}
                </span>
                <div className="race-track__line">
                  <span
                    className="race-track__fill"
                    style={{ width: `${pct * 100}%` }}
                  />
                  <span
                    className={
                      r.status === 'finished'
                        ? 'race-track__dot race-track__dot--finished'
                        : isRowStalled
                          ? 'race-track__dot race-track__dot--stalled'
                          : 'race-track__dot'
                    }
                    data-testid="race-track-dot"
                    data-user-id={r.user_id}
                    style={{ left: `${pct * 100}%` }}
                  />
                </div>
                <span className="race-track__result">
                  {hasResult
                    ? `#${r.placement} · ${Math.round(r.wpm!)} wpm`
                    : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {roundClosed && (
        <p className="race-page__lobby-countdown">
          Back to lobby in {lobbyCountdown}…
        </p>
      )}
    </div>
  )
}
