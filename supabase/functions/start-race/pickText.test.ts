import { assertEquals } from 'jsr:@std/assert@1'
import { pickText, type RaceText } from './pickText.ts'

function texts(...ratings: number[]): RaceText[] {
  return ratings.map((difficulty_rating, i) => ({
    id: `t${i}`,
    difficulty_rating,
  }))
}

Deno.test('pickText - "all" picks uniformly across every approved text', () => {
  const pool = texts(1000, 1200, 1400)

  assertEquals(
    pickText(pool, 'all', () => 0),
    't0',
  )
  assertEquals(
    pickText(pool, 'all', () => 0.999),
    't2',
  )
})

Deno.test(
  'pickText - buckets by difficulty_rating so easy/hard picks stay on the correct side of the distribution',
  () => {
    const pool = texts(100, 200, 300, 400, 500, 600, 700, 800, 900, 1000)

    const easy = pickText(pool, 'easy', () => 0)
    const hard = pickText(pool, 'hard', () => 0.999)

    const easyRating = pool.find((t) => t.id === easy)!.difficulty_rating
    const hardRating = pool.find((t) => t.id === hard)!.difficulty_rating

    if (!(easyRating < hardRating)) {
      throw new Error(
        `expected the easy pick (${easyRating}) to rate below the hard pick (${hardRating})`,
      )
    }
  },
)

Deno.test(
  "pickText - falls back to the full pool when a bucket is empty (e.g. today's seed data, every text sharing the same default rating)",
  () => {
    const pool = texts(1200, 1200, 1200)

    // Every text ties at the easy/hard boundary, so "hard" (strictly above
    // the upper tercile) and "normal" (strictly between the two
    // boundaries) have nothing to pick from and fall back to the full pool.
    assertEquals(
      pickText(pool, 'hard', () => 0),
      't0',
    )
    assertEquals(
      pickText(pool, 'normal', () => 0.999),
      't2',
    )
  },
)

Deno.test('pickText - a single-text pool always returns that text', () => {
  const pool = texts(1200)

  assertEquals(
    pickText(pool, 'all', () => 0.5),
    't0',
  )
  assertEquals(
    pickText(pool, 'easy', () => 0.5),
    't0',
  )
  assertEquals(
    pickText(pool, 'normal', () => 0.5),
    't0',
  )
  assertEquals(
    pickText(pool, 'hard', () => 0.5),
    't0',
  )
})
