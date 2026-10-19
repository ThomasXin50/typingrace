import { useEffect, useRef, useState } from 'react'
import {
  botProgressAtTime,
  calibrateBaseWpm,
  rubberBandPaceMultiplier,
  simulateBotRun,
  type BotRunResult,
} from './botSimulation'
import { DEFAULT_BASE_WPM, type BotPersonality } from './botPersonalities'

interface SimulatedBot {
  id: string
  personality: BotPersonality
}

interface SimulatedRound {
  id: string
  calibration_wpm: number | null
  started_at: string
}

interface UseBotRaceProgressResult {
  /** Latest progress fraction (0-1) per bot id. */
  progress: Record<string, number>
}

// Matches TypingRun's own race-clock tick rate (RACE_CLOCK_TICK_MS) for a
// consistent perceived smoothness - not exported from there, so this is a
// small duplicated literal rather than an import across features.
const TICK_MS = 200

// Bots hold still this long after round.started_at: a human needs a moment
// to react to "go", and their first keystrokes reach other clients over the
// network, so a bot leaving on the exact start instant would always lead.
export const BOT_REACTION_DELAY_MS = 500

interface Simulation {
  runs: Record<string, BotRunResult>
  effectiveMs: Record<string, number>
  multiplier: Record<string, number>
  finished: Set<string>
}

/**
 * Ticks every bot's simulated race forward in real time, rubber-banding
 * each one's pace toward the live human pack's progress. Deliberately
 * re-derives each bot's full run from simulateBotRun on mount/round change
 * rather than storing it anywhere - every connected client does the same,
 * from the same (round id, bot id) seed, and lands on an identical result
 * without any of them needing to coordinate. See
 * src/features/multiplayer/CLAUDE.md.
 */
export function useBotRaceProgress(
  bots: SimulatedBot[],
  round: SimulatedRound | null,
  text: string | null,
  humanProgress: Record<string, number>,
  onBotFinish: (botId: string, run: BotRunResult) => void,
): UseBotRaceProgressResult {
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [simKey, setSimKey] = useState<string | null>(null)

  const humanProgressRef = useRef(humanProgress)
  const onBotFinishRef = useRef(onBotFinish)
  const simulationRef = useRef<Simulation>({
    runs: {},
    effectiveMs: {},
    multiplier: {},
    finished: new Set(),
  })

  // Keeps each ref at its latest value without reading/writing them during
  // render itself - the interval below reads these on every tick, so a
  // stale closure over the initial humanProgress/onBotFinish would
  // otherwise never see a later update.
  useEffect(() => {
    humanProgressRef.current = humanProgress
  })
  useEffect(() => {
    onBotFinishRef.current = onBotFinish
  })

  const currentKey = round && text !== null ? round.id : null

  // Adjust state during render: resets the displayed progress exactly once
  // per round - the same pattern ProfilePage/RoomPage use to seed local
  // state from a prop without an effect that would re-sync (and reset
  // mid-race progress) on every unrelated re-render. Only plain state is
  // touched here; the mutable simulation itself is seeded in the effect
  // below, never during render (refs may not be read/written at this
  // point in the render phase).
  if (currentKey !== simKey) {
    setProgress(Object.fromEntries(bots.map((bot) => [bot.id, 0])))
    setSimKey(currentKey)
  }

  useEffect(() => {
    if (!simKey || !round || text === null) return

    const runs: Record<string, BotRunResult> = {}
    const effectiveMs: Record<string, number> = {}
    const multiplier: Record<string, number> = {}

    for (const bot of bots) {
      const seed = `${round.id}:${bot.id}`
      const baseWpm = calibrateBaseWpm(
        DEFAULT_BASE_WPM[bot.personality],
        round.calibration_wpm,
      )
      runs[bot.id] = simulateBotRun(text, bot.personality, seed, baseWpm)
      effectiveMs[bot.id] = 0
      multiplier[bot.id] = 1
    }

    simulationRef.current = {
      runs,
      effectiveMs,
      multiplier,
      finished: new Set(),
    }

    // The round loads during the pre-race countdown, so ticks before the
    // start (plus the reaction delay) must not advance anyone. Each tick
    // advances by the real time elapsed past that point, so the first one
    // after it counts only the part actually past it.
    const goMs = Date.parse(round.started_at) + BOT_REACTION_DELAY_MS
    let lastTickMs = Date.now()

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsedMs = Math.max(0, now - Math.max(lastTickMs, goMs))
      lastTickMs = now
      if (elapsedMs === 0) return

      const sim = simulationRef.current
      const humanValues = Object.values(humanProgressRef.current)
      const avgHumanProgress =
        humanValues.length > 0
          ? humanValues.reduce((a, b) => a + b, 0) / humanValues.length
          : 0

      const next: Record<string, number> = {}
      for (const bot of bots) {
        if (sim.finished.has(bot.id)) {
          next[bot.id] = 1
          continue
        }

        const run = sim.runs[bot.id]
        const currentProgress = botProgressAtTime(run, sim.effectiveMs[bot.id])
        sim.multiplier[bot.id] = rubberBandPaceMultiplier(
          avgHumanProgress,
          currentProgress,
          sim.multiplier[bot.id],
        )
        sim.effectiveMs[bot.id] += elapsedMs * sim.multiplier[bot.id]

        const updatedProgress = botProgressAtTime(run, sim.effectiveMs[bot.id])
        next[bot.id] = updatedProgress

        if (updatedProgress >= 1) {
          sim.finished.add(bot.id)
          onBotFinishRef.current(bot.id, run)
        }
      }
      setProgress(next)
    }, TICK_MS)

    return () => clearInterval(interval)
    // bots is intentionally excluded - the roster is lobby-only mutable,
    // so once a round starts its content is fixed; depending on it would
    // re-run this effect (and reset every bot's progress) on every
    // unrelated room_bots refetch, since useRoom hands back a new array
    // reference each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simKey])

  return { progress }
}
