import { assertEquals } from 'jsr:@std/assert@1'
import { assessValidation, computeStats, type Keystroke } from './validate.ts'

function typeText(
  text: string,
  startAt: number,
  msPerChar: number,
  trusted = true,
): Keystroke[] {
  return text
    .split('')
    .map((key, i) => ({ key, timestamp: startAt + i * msPerChar, trusted }))
}

Deno.test(
  'computeStats - perfect run computes wpm/accuracy from the raw log alone',
  () => {
    // 25 chars = 5 "words"; first-to-last keystroke spans exactly 60s (24
    // intervals) => 5 wpm.
    const text = 'a'.repeat(25)
    const keystrokes = typeText(text, 0, 60_000 / 24)

    const stats = computeStats(text, keystrokes)

    assertEquals(stats.finished, true)
    assertEquals(stats.wpm, 5)
    assertEquals(stats.rawWpm, 5)
    assertEquals(stats.accuracy, 100)
    assertEquals(stats.errorCount, 0)
  },
)

Deno.test('computeStats - never reaches the end of the text', () => {
  const stats = computeStats('abc', typeText('ab', 0, 100))

  assertEquals(stats.finished, false)
})

Deno.test(
  "computeStats - counts a mistake even after it's corrected with backspace",
  () => {
    const keystrokes: Keystroke[] = [
      { key: 'x', timestamp: 0, trusted: true }, // mistake
      { key: 'Backspace', timestamp: 100, trusted: true },
      { key: 'a', timestamp: 200, trusted: true },
      { key: 'b', timestamp: 300, trusted: true },
    ]

    const stats = computeStats('ab', keystrokes)

    assertEquals(stats.finished, true)
    assertEquals(stats.errorCount, 1)
    assertEquals(stats.accuracy, (2 / 3) * 100)
  },
)

Deno.test(
  'computeStats - locks out further events once the text is complete',
  () => {
    const keystrokes: Keystroke[] = [
      { key: 'a', timestamp: 0, trusted: true },
      { key: 'b', timestamp: 100, trusted: true }, // finishes "ab" here
      { key: 'Backspace', timestamp: 200, trusted: true }, // ignored: already finished
      { key: 'c', timestamp: 300, trusted: true }, // ignored: already finished
    ]

    const stats = computeStats('ab', keystrokes)

    assertEquals(stats.finished, true)
    assertEquals(stats.durationMs, 100)
  },
)

Deno.test('assessValidation - a clean, plausible run is verified', () => {
  const text = 'a'.repeat(25)
  const jitters = [100, 180, 90, 220, 140, 80, 200, 110, 160, 130]
  let t = 0
  const keystrokes: Keystroke[] = text.split('').map((key, i) => {
    t += jitters[i % jitters.length]
    return { key, timestamp: t, trusted: true }
  })
  const stats = computeStats(text, keystrokes)

  assertEquals(assessValidation(keystrokes, stats).status, 'verified')
})

Deno.test('assessValidation - an unfinished run is rejected', () => {
  const keystrokes = typeText('ab', 0, 100)
  const stats = computeStats('abc', keystrokes)

  assertEquals(assessValidation(keystrokes, stats).status, 'rejected')
})

Deno.test(
  'assessValidation - zero elapsed duration is rejected, not treated as 0 wpm',
  () => {
    // Every keystroke shares one timestamp: clock manipulation or a
    // malformed log, not a real human run. (If this fell through to the wpm
    // check, durationMs=0 computes wpm=0 - which reads as "slow", not
    // anomalous, and would wrongly sail through unflagged.)
    const text = 'ab'
    const keystrokes: Keystroke[] = [
      { key: 'a', timestamp: 1000, trusted: true },
      { key: 'b', timestamp: 1000, trusted: true },
    ]
    const stats = computeStats(text, keystrokes)

    assertEquals(stats.durationMs, 0)
    assertEquals(assessValidation(keystrokes, stats).status, 'rejected')
  },
)

Deno.test(
  'assessValidation - any untrusted (scripted) keystroke is rejected',
  () => {
    const text = 'ab'
    const keystrokes = typeText(text, 0, 150, false)
    const stats = computeStats(text, keystrokes)

    assertEquals(assessValidation(keystrokes, stats).status, 'rejected')
  },
)

Deno.test(
  'assessValidation - wpm over the ceiling is flagged, not rejected',
  () => {
    const text = 'a'.repeat(25) // 5 words
    // Finishes in 100ms total => 5 / (100ms/60000) = 3000 wpm, absurd.
    const keystrokes = typeText(text, 0, 4)
    const stats = computeStats(text, keystrokes)

    assertEquals(assessValidation(keystrokes, stats).status, 'flagged')
  },
)

Deno.test(
  'assessValidation - suspiciously uniform keystroke timing is flagged',
  () => {
    const text = 'a'.repeat(30)
    // Perfectly uniform 80ms intervals, zero jitter - not how humans type.
    const keystrokes = typeText(text, 0, 80)
    const stats = computeStats(text, keystrokes)

    assertEquals(assessValidation(keystrokes, stats).status, 'flagged')
  },
)

Deno.test('assessValidation - natural jitter in timing is verified', () => {
  const text = 'a'.repeat(30)
  const jitters = [70, 95, 60, 110, 85, 75, 130, 65, 90, 100]
  let t = 0
  const keystrokes: Keystroke[] = text.split('').map((key, i) => {
    t += jitters[i % jitters.length]
    return { key, timestamp: t, trusted: true }
  })
  const stats = computeStats(text, keystrokes)

  assertEquals(assessValidation(keystrokes, stats).status, 'verified')
})
