/**
 * Averages the room's human members' recent avg wpm (from leaderboard_global),
 * ignoring anyone with no history yet - the pre-race half of bot
 * adaptation (see calibrateBaseWpm in the frontend's botSimulation.ts).
 * Returns null when nobody in the room has a known average, so bots fall
 * back to their personality's own baseline unchanged.
 */
export function averageWpm(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null && v > 0)
  if (known.length === 0) return null
  return known.reduce((a, b) => a + b, 0) / known.length
}
