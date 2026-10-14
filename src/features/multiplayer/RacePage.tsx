import { displayName } from '../../lib/displayName'
import { TypingRun } from '../typing/TypingRun'
import type { Keystroke } from '../typing/useTypingEngine'
import { useActiveRound } from './useActiveRound'
import { useCountdown } from './useCountdown'
import { useRoundResults } from './useRoundResults'
import { useSubmitRoundRun } from './useSubmitRoundRun'
import { useText } from './useText'
import './multiplayer.css'

interface RacePageProps {
  roomId: string
}

// A placeholder for useCountdown while the round hasn't loaded yet - any
// fixed date far enough in the future works, since it's only ever replaced
// by the real round.started_at once data arrives (never displayed or used
// for real countdown math). Must be a static value, not e.g. Date.now() +
// margin: React requires render to stay pure, and useCountdown's initial
// state is seeded once from whatever it's first called with, so this needs
// to read as "not started" immediately, on the very first render.
const PENDING_ROUND_PLACEHOLDER = '2099-01-01T00:00:00.000Z'

export function RacePage({ roomId }: RacePageProps) {
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
  const countdown = useCountdown(round?.started_at ?? PENDING_ROUND_PLACEHOLDER)
  const { results } = useRoundResults(round?.id ?? null)
  const submitRoundRun = useSubmitRoundRun()

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

  if (!round || !content) {
    return <p className="page-status">Waiting for the race to start…</p>
  }

  if (!countdown.hasStarted) {
    return (
      <div className="race-countdown">
        <p className="race-countdown__label">Starting in</p>
        <span className="race-countdown__number">
          {Math.ceil(countdown.msRemaining / 1000)}
        </span>
      </div>
    )
  }

  function handleFinish(keystrokes: Keystroke[]) {
    submitRoundRun.submit(round!.id, keystrokes)
  }

  return (
    <div className="race-page">
      <TypingRun
        content={content}
        now={() => Date.now()}
        startTimestamp={Date.parse(round.started_at)}
        onFinish={handleFinish}
      />

      {results.length > 0 && (
        <ul className="race-results">
          {results.map((r) => (
            <li key={r.user_id} className="race-results__item">
              <span className="race-results__placement">
                {r.placement ? `#${r.placement}` : 'Racing…'}
              </span>
              <span className="race-results__name">
                {displayName(r, results)}
              </span>
              {r.wpm !== null && (
                <span className="race-results__wpm">
                  {Math.round(r.wpm)} wpm
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
