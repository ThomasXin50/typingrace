export interface RaceText {
  id: string
  difficulty_rating: number
}

export type DifficultyFilter = 'easy' | 'normal' | 'hard' | 'all'

function pickFrom(pool: RaceText[], random: () => number): string {
  return pool[Math.floor(random() * pool.length)].id
}

function quantile(sortedRatings: number[], q: number): number {
  return sortedRatings[Math.floor(q * (sortedRatings.length - 1))]
}

/**
 * Picks an approved text matching the room's difficulty filter. "all" is
 * uniform over the whole pool (matches solo's own random pick). The other
 * filters bucket by difficulty_rating terciles rather than a fixed absolute
 * threshold, per DESIGN.md's difficulty-calibration section, so the split
 * stays meaningful as the corpus's real rating spread grows - today's seed
 * texts all share the same default rating, so every bucket but the lowest
 * tercile boundary is empty and falls back to the full pool, which is the
 * correct behavior for data with no real spread yet, not a bug.
 */
export function pickText(
  texts: RaceText[],
  filter: DifficultyFilter,
  random: () => number = Math.random,
): string {
  if (filter === 'all' || texts.length === 0) {
    return pickFrom(texts, random)
  }

  const ratings = texts.map((t) => t.difficulty_rating).sort((a, b) => a - b)
  const easyMax = quantile(ratings, 1 / 3)
  const normalMax = quantile(ratings, 2 / 3)

  const bucket = texts.filter((t) => {
    if (filter === 'easy') return t.difficulty_rating <= easyMax
    if (filter === 'hard') return t.difficulty_rating > normalMax
    return t.difficulty_rating > easyMax && t.difficulty_rating <= normalMax
  })

  return pickFrom(bucket.length > 0 ? bucket : texts, random)
}
