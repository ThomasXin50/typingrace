import { assertEquals } from 'jsr:@std/assert@1'
import { averageWpm } from './calibration.ts'

Deno.test('averageWpm - averages known values', () => {
  assertEquals(averageWpm([60, 80, 100]), 80)
})

Deno.test(
  'averageWpm - ignores null entries (no leaderboard history yet)',
  () => {
    assertEquals(averageWpm([60, null, 80]), 70)
  },
)

Deno.test('averageWpm - ignores non-positive values', () => {
  assertEquals(averageWpm([60, 0, -5]), 60)
})

Deno.test('averageWpm - returns null when nobody has a known average', () => {
  assertEquals(averageWpm([null, null]), null)
  assertEquals(averageWpm([]), null)
})
