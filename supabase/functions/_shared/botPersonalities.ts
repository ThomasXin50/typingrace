// Shared across Edge Functions (create-room's default-bot seeding,
// add-room-bot) via supabase/functions/_shared/, the same pattern as
// validate.ts/completeRound.ts. Mirrored (not shared) with
// src/features/multiplayer/botPersonalities.ts on the frontend side - see
// that file's own comment for why. Keep the personality ids in sync by
// hand across both.
export type BotPersonality = 'coder' | 'typist' | 'monkeytyper' | 'typeracer'

export const BOT_PERSONALITIES: readonly BotPersonality[] = [
  'coder',
  'typist',
  'monkeytyper',
  'typeracer',
]

export function isBotPersonality(value: unknown): value is BotPersonality {
  return (
    typeof value === 'string' &&
    (BOT_PERSONALITIES as readonly string[]).includes(value)
  )
}

/**
 * Resolves what a client requested into an actual personality to store -
 * undefined/"random" picks one via the injected random source (same
 * injectable-randomness pattern as create-room's generateJoinCode, for the
 * same reason: deterministic tests). An unrecognized explicit personality
 * is a caller error, signaled as null rather than silently falling back to
 * a random pick.
 */
export function resolvePersonality(
  requested: string | undefined,
  random: () => number = Math.random,
): BotPersonality | null {
  if (requested === undefined || requested === 'random') {
    return BOT_PERSONALITIES[Math.floor(random() * BOT_PERSONALITIES.length)]
  }
  return isBotPersonality(requested) ? requested : null
}
