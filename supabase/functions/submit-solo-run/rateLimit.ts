export const SUBMISSION_COOLDOWN_MS = 2000

/**
 * Minimum gap between a user's solo_runs submissions. The replay-based
 * validation already scores each submission on its own merits (wpm can't be
 * faked), but without this a scripted client could replay the exact same
 * captured keystroke log repeatedly to pad "total runs" or flood the
 * endpoint. 2s is well below any real run's duration, so it never blocks a
 * legitimate human - fetching a new text alone takes longer than that.
 */
export function isWithinCooldown(
  now: number,
  lastSubmittedAt: number | null,
  cooldownMs: number = SUBMISSION_COOLDOWN_MS,
): boolean {
  if (lastSubmittedAt === null) return false
  return now - lastSubmittedAt < cooldownMs
}
