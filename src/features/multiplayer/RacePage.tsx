import { useEffect, useRef, useState } from 'react'
import { displayName } from '../../lib/displayName'
import { useProfile } from '../auth/useProfile'
import { TypingRun } from '../typing/TypingRun'
import type { Keystroke } from '../typing/useTypingEngine'
import { botDisplayName, type BotPersonality } from './botPersonalities'
import { useActiveRound, type RoundRow } from './useActiveRound'
import { useBotRaceProgress } from './useBotRaceProgress'
import { useCountdown } from './useCountdown'
import { useRaceProgress } from './useRaceProgress'
import { useRoundBotResults } from './useRoundBotResults'
import { useRoundResults } from './useRoundResults'
import { useStallRoundParticipant } from './useStallRoundParticipant'
import { useStallWatcher } from './useStallWatcher'
import { useSubmitBotRun } from './useSubmitBotRun'
import { useSubmitRoundRun } from './useSubmitRoundRun'
import { useText } from './useText'
import './multiplayer.css'

interface RaceBot {
  id: string
  personality: BotPersonality
}

interface RacePageProps {
  roomId: string
  /** The room's bots (see RoomPage/useRoom) - the roster is lobby-only
   * mutable, so this is treated as fixed for the lifetime of a round. */
  bots?: RaceBot[]
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
const STALL_FLASH_MS = 900

export function RacePage({ roomId, bots = [], onDone }: RacePageProps) {
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
  const { results: botResults } = useRoundBotResults(effectiveRound?.id ?? null)
  const submitRoundRun = useSubmitRoundRun()
  const submitBotRun = useSubmitBotRun()
  const { profile } = useProfile()
  const { progress, sendProgress } = useRaceProgress(
    effectiveRound?.id ?? null,
    profile?.id ?? null,
  )
  const { progress: botProgress } = useBotRaceProgress(
    bots,
    effectiveRound,
    effectiveContent,
    progress,
    (botId, run) =>
      submitBotRun.submitBotRun(effectiveRound!.id, botId, {
        wpm: run.wpm,
        rawWpm: run.rawWpm,
        accuracy: run.accuracy,
        errorCount: run.errorCount,
      }),
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

  // Calls out whoever's row just flipped to stalled - a real-time event
  // otherwise easy to miss if you're not already looking at that exact
  // row. Tracks the previously-seen stalled ids so only a genuine
  // transition flashes, not every render while someone's already stalled -
  // null (rather than an empty set) specifically marks "haven't observed a
  // baseline yet", so joining/refreshing into a race where someone is
  // already stalled doesn't flash them either; there's nothing to compare
  // against on that very first render.
  const previousStalledIdsRef = useRef<Set<string> | null>(null)
  const [justStalledIds, setJustStalledIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const currentStalledIds = new Set(
      results.filter((r) => r.status === 'stalled').map((r) => r.user_id),
    )
    const baseline = previousStalledIdsRef.current
    const newlyStalled =
      baseline === null
        ? []
        : [...currentStalledIds].filter((id) => !baseline.has(id))
    previousStalledIdsRef.current = currentStalledIds

    if (newlyStalled.length === 0) return

    setJustStalledIds((prev) => new Set([...prev, ...newlyStalled]))
    const timeout = setTimeout(() => {
      setJustStalledIds((prev) => {
        const next = new Set(prev)
        for (const id of newlyStalled) next.delete(id)
        return next
      })
    }, STALL_FLASH_MS)
    return () => clearTimeout(timeout)
  }, [results])

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

      {(results.length > 0 || bots.length > 0) && (
        <ul className="race-tracks">
          {results.map((r) => {
            const pct = r.status === 'finished' ? 1 : (progress[r.user_id] ?? 0)
            const isSelf = r.user_id === profile?.id
            const hasResult = r.placement !== null && r.wpm !== null
            const isRowStalled = r.status === 'stalled'
            return (
              <li
                key={r.user_id}
                className={[
                  'race-track',
                  isRowStalled && 'race-track--stalled',
                  justStalledIds.has(r.user_id) && 'attention-flash',
                ]
                  .filter(Boolean)
                  .join(' ')}
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
          {bots.map((bot) => {
            const botResult = botResults.find((r) => r.bot_id === bot.id)
            const pct = botResult ? 1 : (botProgress[bot.id] ?? 0)
            return (
              <li key={bot.id} className="race-track">
                <span className="race-track__name">
                  🤖 {botDisplayName(bot, bots)}
                </span>
                <div className="race-track__line">
                  <span
                    className="race-track__fill"
                    style={{ width: `${pct * 100}%` }}
                  />
                  <span
                    className={
                      botResult
                        ? 'race-track__dot race-track__dot--finished'
                        : 'race-track__dot'
                    }
                    data-testid="race-track-dot"
                    data-bot-id={bot.id}
                    style={{ left: `${pct * 100}%` }}
                  />
                </div>
                <span className="race-track__result">
                  {botResult
                    ? `#${botResult.placement} · ${Math.round(botResult.wpm)} wpm`
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
