export function msRemaining(startedAt: string, now: number): number {
  return Math.max(0, Date.parse(startedAt) - now)
}
