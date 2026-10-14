import { TypingRun } from '../typing/TypingRun'
import { useActiveRound } from './useActiveRound'
import { useCountdown } from './useCountdown'
import { useText } from './useText'
import './multiplayer.css'

interface RacePageProps {
  roomId: string
}

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
  const countdown = useCountdown(round?.started_at ?? new Date().toISOString())

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

  return (
    <TypingRun
      content={content}
      now={() => Date.now()}
      startTimestamp={Date.parse(round.started_at)}
    />
  )
}
