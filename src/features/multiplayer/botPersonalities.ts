// Mirrored (not shared) with supabase/functions/add-room-bot/botPersonalities.ts -
// the frontend and Edge Functions are separate TypeScript projects with no
// existing cross-import path between src/ and supabase/functions/, same as
// this codebase's other deliberately-duplicated pairs (see
// src/features/typing/CLAUDE.md's server-mirror invariant). Keep the
// personality ids and count in sync by hand if either changes.
export type BotPersonality = 'coder' | 'typist' | 'monkeytyper' | 'typeracer'

export const BOT_PERSONALITIES: readonly BotPersonality[] = [
  'coder',
  'typist',
  'monkeytyper',
  'typeracer',
]

// Mirrors supabase/functions/add-room-bot/canAddBot.ts's MAX_BOTS_PER_ROOM -
// used here only to disable the add-bot control early, the server call is
// still the actual enforcement.
export const MAX_BOTS_PER_ROOM = 3

export const BOT_PERSONALITY_NAMES: Record<BotPersonality, string> = {
  coder: 'The Coder',
  typist: 'The Typist',
  monkeytyper: 'The Monkeytyper',
  typeracer: 'The Typeracer',
}

interface ListedBot {
  id: string
  personality: BotPersonality
}

/**
 * Renders a bot's personality name for a roster/race listing, disambiguated
 * the same way displayName.ts disambiguates duplicate guests - a short id
 * suffix, only once more than one bot in the listing shares a personality.
 */
export function botDisplayName(bot: ListedBot, listing: ListedBot[]): string {
  const name = BOT_PERSONALITY_NAMES[bot.personality]
  const sharingCount = listing.filter(
    (b) => b.personality === bot.personality,
  ).length
  if (sharingCount <= 1) return name

  return `${name} #${bot.id.slice(-4)}`
}
